-- Migration: Add Wish List Feature

-- Create wish list items table
CREATE TABLE wish_list_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Enable RLS
ALTER TABLE wish_list_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their wish list items"
  ON wish_list_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check if an item is in a user's wish list
CREATE OR REPLACE FUNCTION is_in_wishlist(item_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM wish_list_items
    WHERE user_id = auth.uid()
    AND item_id = is_in_wishlist.item_id
  );
$$;

-- Function to add item to wish list
CREATE OR REPLACE FUNCTION add_to_wishlist(item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO wish_list_items (user_id, item_id)
  VALUES (auth.uid(), item_id)
  ON CONFLICT (user_id, item_id) DO NOTHING;
END;
$$;

-- Function to remove item from wish list
CREATE OR REPLACE FUNCTION remove_from_wishlist(item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM wish_list_items
  WHERE user_id = auth.uid()
  AND item_id = remove_from_wishlist.item_id;
END;
$$;

-- Function to get user's wish list items
CREATE OR REPLACE FUNCTION get_wishlist_items(limit_val int DEFAULT 50, offset_val int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  title text,
  price decimal,
  condition text,
  images text[],
  added_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    i.id,
    i.title,
    i.price,
    i.condition,
    i.images,
    wl.added_at
  FROM wish_list_items wl
  JOIN items i ON wl.item_id = i.id
  WHERE wl.user_id = auth.uid()
    AND i.is_active = true
  ORDER BY wl.added_at DESC
  LIMIT limit_val
  OFFSET offset_val;
$$;