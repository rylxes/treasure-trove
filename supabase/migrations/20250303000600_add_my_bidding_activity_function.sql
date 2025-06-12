-- Function to get bidding activity for the current user
-- Version 2: Refined is_my_bid_highest and auction_status logic

CREATE OR REPLACE FUNCTION public.get_my_bidding_activity()
RETURNS TABLE (
    item_id uuid,
    item_title text,
    item_image_url text,
    item_ends_at timestamptz,
    item_is_active boolean,
    item_selling_method selling_method,
    item_current_bid_amount decimal,
    my_highest_bid_amount decimal,
    is_my_bid_highest boolean,
    auction_status text -- e.g., 'active_leading', 'active_outbid', 'ended_won', 'ended_lost', 'ended_processing', 'ended_no_bids'
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
    current_user_id uuid := auth.uid();
BEGIN
    RETURN QUERY
    WITH user_bids_on_items AS (
        -- Find all items the user has bid on and their highest bid on each
        SELECT
            b.item_id,
            MAX(b.bid_amount) as my_max_bid_on_item -- Renamed for clarity
        FROM public.bids b
        WHERE b.user_id = current_user_id
        GROUP BY b.item_id
    )
    SELECT
        i.id AS item_id,
        i.title AS item_title,
        i.images[1] AS item_image_url, -- Get the first image URL, assumes images array is 1-indexed in PG
        i.ends_at AS item_ends_at,
        i.is_active AS item_is_active,
        i.selling_method AS item_selling_method,
        i.current_bid_amount AS item_current_bid_amount,
        ub.my_max_bid_on_item AS my_highest_bid_amount,
        (
            -- Check if the user_id associated with the item's current_highest_bid_id is the current user
            -- This is true if the current user is the one holding the highest bid recorded on the item.
            (SELECT bh.user_id FROM public.bids bh WHERE bh.id = i.current_highest_bid_id) = current_user_id
        ) AS is_my_bid_highest,
        CASE
            WHEN i.selling_method != 'auction' THEN 'not_auction' -- Should be filtered by WHERE clause below, but as safeguard
            WHEN i.is_active = true AND i.ends_at IS NOT NULL AND i.ends_at > NOW() THEN -- Active auction
                CASE
                    -- Directly check if the user for the item's current_highest_bid_id is the current user
                    WHEN (SELECT bh.user_id FROM public.bids bh WHERE bh.id = i.current_highest_bid_id) = current_user_id THEN 'active_leading'
                    -- If there's no current highest bid yet (e.g. first bid), but user has bid at/above starting price
                    WHEN i.current_highest_bid_id IS NULL AND ub.my_max_bid_on_item >= i.price THEN 'active_leading_first_bidder'
                    -- User has bid, but is not leading (either outbid, or someone else is leading, or no one is leading but user's bid too low)
                    ELSE 'active_outbid'
                END
            WHEN i.is_active = true AND i.ends_at IS NOT NULL AND i.ends_at <= NOW() THEN 'ended_processing' -- Auction ended, awaiting process_auction_end
            WHEN i.is_active = false AND i.ends_at IS NOT NULL AND i.ends_at <= NOW() THEN -- Auction has been processed
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM public.transactions t
                        WHERE t.item_id = i.id AND t.buyer_id = current_user_id AND t.status IN ('pending', 'processing', 'completed', 'shipped') -- Added more transaction statuses
                    ) THEN 'ended_won'
                    -- If the item ended and current_bid_amount is NULL, it means no valid bids were processed to become the final sale.
                    WHEN i.current_bid_amount IS NULL THEN 'ended_no_bids'
                    ELSE 'ended_lost'
                END
            WHEN i.ends_at IS NULL AND i.selling_method = 'auction' THEN 'auction_error_no_end_date' -- Data integrity issue or misconfigured auction
            ELSE 'unknown_status'
        END AS auction_status
    FROM public.items i
    JOIN user_bids_on_items ub ON i.id = ub.item_id -- Only include items the user has bid on
    WHERE i.selling_method = 'auction' -- Ensure we are only dealing with items that are intended to be auctions
    ORDER BY
        CASE
            WHEN i.is_active = true AND i.ends_at IS NOT NULL AND i.ends_at > NOW() THEN 1 -- Active auctions first
            WHEN i.is_active = true AND i.ends_at IS NOT NULL AND i.ends_at <= NOW() THEN 2 -- Ended, pending processing
            WHEN i.is_active = false THEN 3 -- Processed auctions
            ELSE 4 -- Others (e.g., error states)
        END,
        i.ends_at DESC NULLS LAST, -- Auctions ending sooner appear higher
        i.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_my_bidding_activity() IS 'Retrieves a summary of auction items the current user has bid on, their highest bid for each item, and the current status of each auction (e.g., active_leading, active_outbid, ended_won, ended_lost).';
