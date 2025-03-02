/*
  # Fix Order By Position Error

  1. Changes
    - Fix ORDER BY position reference in generate_similar_items function
*/

-- Update the generate_similar_items function to fix the ORDER BY position
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
      END)) AS similarity_score
    FROM items i
    WHERE i.id != item_record.id
      AND i.is_active = TRUE
      AND i.category_id = item_record.category_id
      -- Exclude items that are too different in price (> 50% difference)
      AND ABS(i.price - item_record.price) / GREATEST(item_record.price, 1) <= 0.5
    ORDER BY similarity_score DESC  -- Fixed: Use column name instead of position
    LIMIT 10;
  END LOOP;
END;
$$;