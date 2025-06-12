-- Create item_reviews table
CREATE TABLE public.item_reviews (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS to item_reviews table
ALTER TABLE public.item_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for item_reviews
CREATE POLICY "Public item reviews are viewable by everyone"
  ON public.item_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own item reviews"
  ON public.item_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own item reviews"
  ON public.item_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own item reviews"
  ON public.item_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Add columns to items table for average rating and review count
ALTER TABLE public.items
ADD COLUMN average_item_rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN item_review_count INT DEFAULT 0;

-- Function to update item average rating and review count
CREATE OR REPLACE FUNCTION update_item_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.items
  SET
    average_item_rating = (
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM public.item_reviews
      WHERE item_id = NEW.item_id
    ),
    item_review_count = (
      SELECT COUNT(*)
      FROM public.item_reviews
      WHERE item_id = NEW.item_id
    )
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update item average rating after insert, update, or delete on item_reviews
CREATE TRIGGER on_item_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.item_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_item_average_rating();

-- If a review is deleted, the OLD.item_id needs to be used for the update
CREATE OR REPLACE FUNCTION update_item_average_rating_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.items
  SET
    average_item_rating = COALESCE((
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM public.item_reviews
      WHERE item_id = OLD.item_id
    ), 0.00), -- Set to 0 if no reviews are left
    item_review_count = (
      SELECT COUNT(*)
      FROM public.item_reviews
      WHERE item_id = OLD.item_id
    )
  WHERE id = OLD.item_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Need to drop the previous trigger and recreate to handle deletes correctly.
-- It's often simpler to have one trigger function that handles INSERT, UPDATE, DELETE
-- and uses NEW.item_id for INSERT/UPDATE and OLD.item_id for DELETE.

-- Let's redefine the trigger function and trigger:

DROP TRIGGER IF EXISTS on_item_review_change ON public.item_reviews;
DROP TRIGGER IF EXISTS on_item_review_delete ON public.item_reviews; -- if a specific delete trigger was made

CREATE OR REPLACE FUNCTION handle_item_review_changes()
RETURNS TRIGGER AS $$
DECLARE
    target_item_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_item_id := OLD.item_id;
    ELSE
        target_item_id := NEW.item_id;
    END IF;

    UPDATE public.items
    SET
        average_item_rating = COALESCE((
            SELECT AVG(rating)::DECIMAL(3,2)
            FROM public.item_reviews
            WHERE item_id = target_item_id
        ), 0.00),
        item_review_count = (
            SELECT COUNT(*)
            FROM public.item_reviews
            WHERE item_id = target_item_id
        )
    WHERE id = target_item_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_item_review_modified
  AFTER INSERT OR UPDATE OR DELETE ON public.item_reviews
  FOR EACH ROW
  EXECUTE FUNCTION handle_item_review_changes();

-- Make sure the function and trigger are owned by supabase_admin or a suitable role if RLS is involved for functions.
-- For simplicity, SECURITY DEFINER is used, assuming the function is created by a superuser or a role with sufficient privileges.
-- The `update_user_rating` function in the initial schema also used SECURITY DEFINER.

COMMENT ON TABLE public.item_reviews IS 'Stores user-submitted reviews and ratings for individual items.';
COMMENT ON COLUMN public.items.average_item_rating IS 'Average rating calculated from item_reviews.';
COMMENT ON COLUMN public.items.item_review_count IS 'Total count of reviews for this item from item_reviews.';
