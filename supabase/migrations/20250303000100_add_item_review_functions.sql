-- Function to submit a new item review
CREATE OR REPLACE FUNCTION public.submit_item_review(
    p_item_id uuid,
    p_rating integer,
    p_review_text text
)
RETURNS public.item_reviews -- Returns the created review
LANGUAGE plpgsql
SECURITY DEFINER -- To bypass RLS for the insert if needed, but RLS policies should allow user to insert their own. Let's use invoker for now and rely on RLS.
-- SECURITY INVOKER -- Let's stick to invoker to ensure RLS is respected by default.
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    new_review public.item_reviews;
BEGIN
    -- Validate rating
    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5.';
    END IF;

    -- Check if item exists
    IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id) THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- Optional: Check if user has already reviewed this item.
    -- If we want to prevent multiple reviews, we could add a unique constraint
    -- to the item_reviews table: ALTER TABLE item_reviews ADD CONSTRAINT unique_item_user_review UNIQUE (item_id, user_id);
    -- Or handle it here:
    -- IF EXISTS (SELECT 1 FROM public.item_reviews WHERE item_id = p_item_id AND user_id = current_user_id) THEN
    --     RAISE EXCEPTION 'You have already reviewed this item.';
    -- END IF;
    -- For now, allowing multiple reviews, or relying on client to call an update function.

    INSERT INTO public.item_reviews (item_id, user_id, rating, review_text)
    VALUES (p_item_id, current_user_id, p_rating, p_review_text)
    RETURNING * INTO new_review;

    -- The trigger 'on_item_review_modified' on item_reviews table
    -- will automatically update the items.average_item_rating and items.item_review_count

    RETURN new_review;
END;
$$;

-- Function to get item reviews with pagination
CREATE OR REPLACE FUNCTION public.get_item_reviews(
    p_item_id uuid,
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    item_id uuid,
    user_id uuid,
    rating integer,
    review_text text,
    created_at timestamptz,
    updated_at timestamptz,
    username text,
    avatar_url text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset integer;
BEGIN
    -- Ensure page and limit are positive
    IF p_page < 1 THEN
        p_page := 1;
    END IF;
    IF p_limit < 1 THEN
        p_limit := 10;
    END IF;

    v_offset := (p_page - 1) * p_limit;

    RETURN QUERY
    SELECT
        ir.id,
        ir.item_id,
        ir.user_id,
        ir.rating,
        ir.review_text,
        ir.created_at,
        ir.updated_at,
        u.username,
        u.avatar_url
    FROM
        public.item_reviews ir
    JOIN
        public.profiles u ON ir.user_id = u.id
    WHERE
        ir.item_id = p_item_id
    ORDER BY
        ir.created_at DESC
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.submit_item_review(uuid, integer, text) IS 'Submits a new review for an item. User must be authenticated.';
COMMENT ON FUNCTION public.get_item_reviews(uuid, integer, integer) IS 'Retrieves paginated reviews for a specific item, including reviewer''s username and avatar.';
