/*
  # Fix Missing Similarity Function

  1. Changes
    - Enable pg_trgm extension if not already enabled
    - Add fallback similarity function if extension can't be enabled
    - Update functions that use similarity to handle fallbacks
*/

-- Try to enable the pg_trgm extension which provides similarity function
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable pg_trgm extension: %', SQLERRM;
END $$;

-- Create a fallback similarity function if the extension isn't available
-- This basic version returns 0 for different strings and 1 for identical strings
CREATE OR REPLACE FUNCTION safe_similarity(a text, b text)
RETURNS float4
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Check if the pg_trgm extension's similarity function exists
  BEGIN
    -- Try to use the real similarity function from pg_trgm
    RETURN similarity(a, b);
  EXCEPTION
    WHEN undefined_function THEN
      -- Fallback to a basic implementation
      IF a IS NULL OR b IS NULL THEN
        RETURN 0;
      ELSIF a = b THEN
        RETURN 1;
      ELSE
        -- Simple word overlap calculation (basic fallback)
        DECLARE
          words_a text[];
          words_b text[];
          common_count int := 0;
          total_words int;
        BEGIN
          -- Convert to lowercase and split into words
          words_a := regexp_split_to_array(lower(a), '\s+');
          words_b := regexp_split_to_array(lower(b), '\s+');

          -- Count common words (simplified approach)
          FOR i IN 1..array_length(words_a, 1) LOOP
            FOR j IN 1..array_length(words_b, 1) LOOP
              IF words_a[i] = words_b[j] AND length(words_a[i]) > 2 THEN
                common_count := common_count + 1;
                EXIT;
              END IF;
            END LOOP;
          END LOOP;

          total_words := array_length(words_a, 1) + array_length(words_b, 1);
          IF total_words > 0 THEN
            RETURN (2.0 * common_count / total_words)::float4;
          ELSE
            RETURN 0;
          END IF;
        END;
      END IF;
  END;
END;
$$;

-- Update the generate_similar_items function to use safe_similarity
CREATE OR REPLACE FUNCTION generate_similar_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_record RECORD;
BEGIN
  -- Process in batches
  FOR item_record IN SELECT id, category_id, price, description FROM items WHERE is_active = TRUE LOOP
    -- Delete existing similarities for this specific item
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
        THEN safe_similarity(i.description, item_record.description)
        ELSE 0
      END))
    FROM items i
    WHERE i.id != item_record.id
      AND i.is_active = TRUE
      AND i.category_id = item_record.category_id
      -- Exclude items that are too different in price (> 50% difference)
      AND ABS(i.price - item_record.price) / GREATEST(item_record.price, 1) <= 0.5
    ORDER BY 4 DESC
    LIMIT 10;
  END LOOP;
END;
$$;

-- Update the item similarity trigger to use safe_similarity
CREATE OR REPLACE FUNCTION update_item_similarity_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing similarity records for this item
  DELETE FROM similar_items WHERE item_id = NEW.id OR similar_item_id = NEW.id;

  -- Find similar items for this specific item
  INSERT INTO similar_items (item_id, similar_item_id, similarity_score)
  SELECT
    NEW.id,
    i.id,
    -- Calculate similarity score
    0.5 +
    (0.3 * (1.0 - LEAST(ABS(i.price - NEW.price) / GREATEST(NEW.price, 1), 1.0))) +
    (0.2 * (CASE
      WHEN i.description IS NOT NULL AND NEW.description IS NOT NULL
      THEN safe_similarity(i.description, NEW.description)
      ELSE 0
    END))
  FROM items i
  WHERE i.id != NEW.id
    AND i.is_active = TRUE
    AND i.category_id = NEW.category_id
    AND ABS(i.price - NEW.price) / GREATEST(NEW.price, 1) <= 0.5
  ORDER BY 3 DESC
  LIMIT 10;

  RETURN NEW;
END;
$$;

-- Update the daily recommendation update to handle errors better
CREATE OR REPLACE FUNCTION daily_recommendation_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Run each step individually so if one fails, others can still run
  BEGIN
    -- Update similar items
    PERFORM generate_similar_items();
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error updating similar items: %', SQLERRM;
  END;

  BEGIN
    -- Update personalized recommendations
    PERFORM generate_personalized_recommendations();
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error updating personalized recommendations: %', SQLERRM;
  END;

  BEGIN
    -- Update popular recommendations
    PERFORM generate_popular_recommendations();
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error updating popular recommendations: %', SQLERRM;
  END;
END;
$$;

-- Update admin function to better handle errors
CREATE OR REPLACE FUNCTION admin_update_recommendations()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  errors text := '';
  success_count int := 0;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can update recommendations';
  END IF;

  -- Run each step individually to collect errors
  BEGIN
    -- Update similar items
    PERFORM generate_similar_items();
    success_count := success_count + 1;
  EXCEPTION
    WHEN OTHERS THEN
      errors := errors || 'Error updating similar items: ' || SQLERRM || '. ';
  END;

  BEGIN
    -- Update personalized recommendations
    PERFORM generate_personalized_recommendations();
    success_count := success_count + 1;
  EXCEPTION
    WHEN OTHERS THEN
      errors := errors || 'Error updating personalized recommendations: ' || SQLERRM || '. ';
  END;

  BEGIN
    -- Update popular recommendations
    PERFORM generate_popular_recommendations();
    success_count := success_count + 1;
  EXCEPTION
    WHEN OTHERS THEN
      errors := errors || 'Error updating popular recommendations: ' || SQLERRM || '. ';
  END;

  -- Log action
  INSERT INTO admin_logs (admin_id, action, details)
  VALUES (
    auth.uid(),
    'update_recommendations',
    jsonb_build_object(
      'timestamp', now(),
      'success_count', success_count,
      'errors', errors
    )
  );

  IF success_count = 3 THEN
    RETURN 'All recommendation updates completed successfully';
  ELSIF success_count > 0 THEN
    RETURN success_count || ' of 3 recommendation updates completed. Errors: ' || errors;
  ELSE
    RETURN 'Recommendation update failed: ' || errors;
  END IF;
END;
$$;