-- Function to submit a seller review (associated with a transaction)
CREATE OR REPLACE FUNCTION public.submit_seller_review(
    p_transaction_id uuid,
    p_seller_user_id uuid, -- The user ID of the seller being reviewed
    p_rating integer,
    p_review_comment text
)
RETURNS public.reviews -- Returns the created review
LANGUAGE plpgsql
SECURITY INVOKER -- Run with the permissions of the calling user
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    transaction_details record;
    new_review public.reviews;
BEGIN
    -- Validate rating
    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5.';
    END IF;

    -- Validate transaction: ensure current user is the buyer and the p_seller_user_id is the seller
    SELECT * INTO transaction_details FROM public.transactions
    WHERE id = p_transaction_id AND buyer_id = current_user_id AND seller_id = p_seller_user_id;

    IF transaction_details IS NULL THEN
        RAISE EXCEPTION 'Invalid transaction, or you are not authorized to review this transaction for this seller.';
    END IF;

    -- Check if this buyer has already reviewed this seller for this specific transaction
    -- The existing table `reviews` has `transaction_id`, `reviewer_id`, `reviewed_id`.
    -- A buyer should probably only review a seller once per transaction.
    -- We might need a unique constraint: ALTER TABLE reviews ADD CONSTRAINT unique_review_per_transaction UNIQUE (transaction_id, reviewer_id, reviewed_id);
    -- For now, the function will allow inserting if the constraint isn't there, or fail if it is.
    -- Let's assume for now that a user can only submit one review per transaction for a seller.
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE transaction_id = p_transaction_id
        AND reviewer_id = current_user_id
        AND reviewed_id = p_seller_user_id
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this seller for this transaction.';
    END IF;

    INSERT INTO public.reviews (transaction_id, reviewer_id, reviewed_id, rating, comment)
    VALUES (p_transaction_id, current_user_id, p_seller_user_id, p_rating, p_review_comment)
    RETURNING * INTO new_review;

    -- The existing trigger 'on_review_created' on the 'reviews' table (which calls 'update_user_rating')
    -- will automatically update the seller's (profile.rating) average rating and count.

    RETURN new_review;
END;
$$;

-- Function to get seller reviews with pagination
CREATE OR REPLACE FUNCTION public.get_seller_reviews(
    p_seller_user_id uuid, -- The user ID of the seller whose reviews are being fetched
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    transaction_id uuid,
    reviewer_id uuid, -- User who wrote the review (buyer)
    reviewed_id uuid, -- Seller who was reviewed
    rating integer,
    comment text,
    created_at timestamptz,
    reviewer_username text,
    reviewer_avatar_url text
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
        r.id,
        r.transaction_id,
        r.reviewer_id,
        r.reviewed_id,
        r.rating,
        r.comment,
        r.created_at,
        p_reviewer.username AS reviewer_username,
        p_reviewer.avatar_url AS reviewer_avatar_url
    FROM
        public.reviews r
    JOIN
        public.profiles p_reviewer ON r.reviewer_id = p_reviewer.id
    WHERE
        r.reviewed_id = p_seller_user_id -- Fetching reviews FOR this seller
    ORDER BY
        r.created_at DESC
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.submit_seller_review(uuid, uuid, integer, text) IS 'Submits a new review for a seller based on a transaction. User must be the buyer in the transaction.';
COMMENT ON FUNCTION public.get_seller_reviews(uuid, integer, integer) IS 'Retrieves paginated reviews for a specific seller, including the reviewer''s username and avatar.';
