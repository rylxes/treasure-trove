/*
  # Fix Recommendation Functions

  1. Changes
    - Fix DELETE statements in recommendation functions
    - Fix syntax errors in function declarations
    - Improve error handling
*/

-- First function with fixed DELETE
CREATE OR REPLACE FUNCTION generate_personalized_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  viewed_categories jsonb;
  avg_price decimal;
  min_price decimal;
  max_price decimal;
BEGIN
  -- Instead of direct DELETE, use a targeted approach with a temp table
  BEGIN
    -- Safely delete personalized recommendations
    DELETE FROM recommended_items WHERE recommendation_type = 'personalized' AND id IS NOT NULL;
  EXCEPTION
    WHEN OTHERS THEN
      -- If general DELETE fails, use a cursor-based approach
      DECLARE
        rec_cursor CURSOR FOR SELECT id FROM recommended_items WHERE recommendation_type = 'personalized';
        rec_id uuid;
      BEGIN
        OPEN rec_cursor;
        LOOP
          FETCH rec_cursor INTO rec_id;
          EXIT WHEN NOT FOUND;

          -- Delete one record at a time
          DELETE FROM recommended_items WHERE id = rec_id;
        END LOOP;
        CLOSE rec_cursor;
      END;
  END;

  -- Process each user
  FOR user_record IN SELECT id FROM profiles LOOP
    -- Get categories the user has viewed
    SELECT
      jsonb_agg(DISTINCT category_id) AS categories,
      AVG(price) AS avg,
      MIN(price) AS min,
      MAX(price) AS max
    INTO
      viewed_categories, avg_price, min_price, max_price
    FROM items i
    JOIN recently_viewed_items rv ON i.id = rv.item_id
    WHERE rv.user_id = user_record.id;

    -- Skip users with no viewing history
    IF viewed_categories IS NULL THEN
      CONTINUE;
    END IF;

    -- Find items in viewed categories and price range
    INSERT INTO recommended_items (user_id, item_id, score, recommendation_type)
    SELECT
      user_record.id,
      i.id,
      -- Calculate recommendation score
      -- Factors: matching category (0.6), price similarity (0.4)
      0.6 +
      (0.4 * (1.0 - LEAST(
        ABS(i.price - avg_price) /
        GREATEST(max_price - min_price, 1),
        1.0
      ))),
      'personalized'
    FROM items i
    WHERE i.is_active = TRUE
      -- Only include items in categories the user has viewed
      AND i.category_id IN (SELECT jsonb_array_elements_text(viewed_categories)::uuid)
      -- Exclude items the user has already viewed
      AND NOT EXISTS (
        SELECT 1 FROM recently_viewed_items rv
        WHERE rv.user_id = user_record.id AND rv.item_id = i.id
      )
      -- Exclude items the user is selling
      AND i.seller_id != user_record.id
    ORDER BY RANDOM()
    LIMIT 20
    ON CONFLICT (user_id, item_id, recommendation_type) DO UPDATE
    SET score = EXCLUDED.score,
        updated_at = now();
  END LOOP;
END;
$$;

-- Second function with fixed DELETE
CREATE OR REPLACE FUNCTION generate_popular_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Instead of direct DELETE, use a targeted approach with exception handling
  BEGIN
    -- Safely delete popular recommendations
    DELETE FROM recommended_items WHERE recommendation_type = 'popular' AND id IS NOT NULL;
  EXCEPTION
    WHEN OTHERS THEN
      -- If general DELETE fails, use a cursor-based approach
      DECLARE
        rec_cursor CURSOR FOR SELECT id FROM recommended_items WHERE recommendation_type = 'popular';
        rec_id uuid;
      BEGIN
        OPEN rec_cursor;
        LOOP
          FETCH rec_cursor INTO rec_id;
          EXIT WHEN NOT FOUND;

          -- Delete one record at a time
          DELETE FROM recommended_items WHERE id = rec_id;
        END LOOP;
        CLOSE rec_cursor;
      END;
  END;

  -- Process each user
  FOR user_record IN SELECT id FROM profiles LOOP
    -- Assign popular items to user
    INSERT INTO recommended_items (user_id, item_id, score, recommendation_type)
    SELECT
      user_record.id,
      i.id,
      -- Score based on popularity (views)
      LEAST(i.views::decimal / 100, 1.0),
      'popular'
    FROM items i
    WHERE i.is_active = TRUE
      -- Exclude items the user has already viewed
      AND NOT EXISTS (
        SELECT 1 FROM recently_viewed_items rv
        WHERE rv.user_id = user_record.id AND rv.item_id = i.id
      )
      -- Exclude items the user is selling
      AND i.seller_id != user_record.id
    ORDER BY i.views DESC, i.created_at DESC
    LIMIT 20
    ON CONFLICT (user_id, item_id, recommendation_type) DO UPDATE
    SET score = EXCLUDED.score,
        updated_at = now();
  END LOOP;
END;
$$;

-- Function to generate similar items with fixed approach
CREATE OR REPLACE FUNCTION generate_similar_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_record RECORD;
BEGIN
  -- Instead of clearing all similar items at once, process in batches
  -- First, create a list of active items
  FOR item_record IN SELECT id, category_id, price, description FROM items WHERE is_active = TRUE LOOP
    -- Delete existing similarities for this specific item (targeted approach)
    DELETE FROM similar_items WHERE item_id = item_record.id;

    -- Find similar items based on category and price range
    INSERT INTO similar_items (item_id, similar_item_id, similarity_score)
    SELECT
      item_record.id,
      i.id,
      -- Calculate similarity score (higher is better)
      -- Factors: same category (0.5), price similarity (0.3), text similarity in description (0.2)
      0.5 +
      (0.3 * (1.0 - LEAST(ABS(i.price - item_record.price) / GREATEST(item_record.price, 1), 1.0))) +
      (0.2 * (CASE
        WHEN i.description IS NOT NULL AND item_record.description IS NOT NULL
        THEN similarity(i.description, item_record.description)
        ELSE 0
      END))
    FROM items i
    WHERE i.id != item_record.id
      AND i.is_active = TRUE
      AND i.category_id = item_record.category_id
      -- Exclude items that are too different in price (> 50% difference)
      AND ABS(i.price - item_record.price) / GREATEST(item_record.price, 1) <= 0.5
    ORDER BY similarity_score DESC
    LIMIT 10;
  END LOOP;
END;
$$;

-- Updated admin function to properly handle errors
CREATE OR REPLACE FUNCTION admin_update_recommendations()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can update recommendations';
  END IF;

  -- Perform update
  BEGIN
    -- Update similar items
    PERFORM generate_similar_items();

    -- Update personalized recommendations
    PERFORM generate_personalized_recommendations();

    -- Update popular recommendations
    PERFORM generate_popular_recommendations();
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error
      INSERT INTO admin_logs (admin_id, action, details)
      VALUES (
        auth.uid(),
        'update_recommendations_failed',
        jsonb_build_object('timestamp', now(), 'error', SQLERRM)
      );

      RAISE EXCEPTION 'Failed to update recommendations: %', SQLERRM;
  END;

  -- Log successful action
  INSERT INTO admin_logs (admin_id, action, details)
  VALUES (
    auth.uid(),
    'update_recommendations',
    jsonb_build_object('timestamp', now(), 'status', 'success')
  );

  RETURN 'Recommendation update completed successfully';
END;
$$;

-- Add a test function to help diagnose database capabilities
CREATE OR REPLACE FUNCTION test_recommendations_delete()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec_count INTEGER;
  del_style INTEGER := 0;
  result TEXT := 'Delete test results: ';
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can run tests';
  END IF;

  -- Count personalized recommendations
  SELECT COUNT(*) INTO rec_count FROM recommended_items WHERE recommendation_type = 'personalized';
  result := result || 'Found ' || rec_count || ' personalized recommendations. ';

  -- Try different delete approaches and see which one works
  BEGIN
    -- Approach 1: Basic DELETE with column conditions
    DELETE FROM recommended_items WHERE recommendation_type = 'personalized' AND id IS NOT NULL;
    del_style := 1;
  EXCEPTION
    WHEN OTHERS THEN
      BEGIN
        -- Approach 2: DELETE with a subquery
        DELETE FROM recommended_items
        WHERE id IN (SELECT id FROM recommended_items WHERE recommendation_type = 'personalized');
        del_style := 2;
      EXCEPTION
        WHEN OTHERS THEN
          -- Approach 3: Use a cursor-based approach
          DECLARE
            rec_cursor CURSOR FOR SELECT id FROM recommended_items WHERE recommendation_type = 'personalized';
            rec_id uuid;
          BEGIN
            OPEN rec_cursor;
            LOOP
              FETCH rec_cursor INTO rec_id;
              EXIT WHEN NOT FOUND;

              -- Delete one record at a time
              DELETE FROM recommended_items WHERE id = rec_id;
            END LOOP;
            CLOSE rec_cursor;
            del_style := 3;
          END;
      END;
  END;

  -- Check how many recommendations are left
  SELECT COUNT(*) INTO rec_count FROM recommended_items WHERE recommendation_type = 'personalized';
  result := result || 'After delete (style ' || del_style || '): ' || rec_count || ' recommendations remain.';

  RETURN result;
END;
$$;