-- Add status column to items table
ALTER TABLE items
ADD COLUMN status text CHECK (status IN ('listed', 'sold', 'pending', 'inactive')) DEFAULT 'listed';

-- Function remains as originally proposed
CREATE OR REPLACE FUNCTION get_user_items()
RETURNS TABLE (
  type text,
  id uuid,
  title text,
  price decimal,
  images text[],
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Items offered for sale
  RETURN QUERY
    SELECT
      'offered'::text AS type,
      i.id,
      i.title,
      i.price,
      i.images,
      i.status,
      i.created_at
    FROM items i
    WHERE i.seller_id = auth.uid()
    ORDER BY i.created_at DESC;

  -- Items bought
  RETURN QUERY
    SELECT
      'bought'::text AS type,
      i.id,
      i.title,
      i.price,
      i.images,
      i.status,
      i.created_at
    FROM items i
    JOIN transactions t ON t.item_id = i.id
    WHERE t.buyer_id = auth.uid()
    ORDER BY i.created_at DESC;
END;
$$;