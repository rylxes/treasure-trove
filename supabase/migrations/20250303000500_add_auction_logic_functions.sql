-- Function to place a bid on an auction item
CREATE OR REPLACE FUNCTION public.place_bid(
    p_item_id uuid,
    p_bid_amount decimal
)
RETURNS public.bids -- Returns the newly created bid record
LANGUAGE plpgsql
SECURITY INVOKER -- Runs with the permissions of the calling user; RLS on `bids` table handles insert permission.
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    item_details public.items;
    new_bid public.bids;
    min_next_bid decimal;
BEGIN
    -- 1. Validate user authentication (implicit by auth.uid())

    -- 2. Fetch item details
    SELECT * INTO item_details FROM public.items WHERE id = p_item_id;

    IF item_details IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- 3. Validate item is an active auction and not ended
    IF item_details.selling_method != 'auction' THEN
        RAISE EXCEPTION 'This item is not for auction.';
    END IF;
    IF item_details.is_active = false THEN
        RAISE EXCEPTION 'This auction is not active.';
    END IF;
    IF item_details.ends_at <= NOW() THEN
        RAISE EXCEPTION 'This auction has ended.';
    END IF;

    -- 4. Seller cannot bid on their own item
    IF item_details.seller_id = current_user_id THEN
        RAISE EXCEPTION 'You cannot bid on your own item.';
    END IF;

    -- 5. Validate bid amount
    IF item_details.current_bid_amount IS NOT NULL THEN
        min_next_bid := item_details.current_bid_amount + 0.01; -- Basic increment
    ELSE
        min_next_bid := item_details.price + 0.01; -- Must be at least starting price + 0.01 if no bids
         -- Ensure bid is at least the starting price
        IF p_bid_amount < item_details.price THEN
             RAISE EXCEPTION 'Your bid must be at least the starting price of %.', item_details.price;
        END IF;
    END IF;

    IF p_bid_amount < min_next_bid THEN
        RAISE EXCEPTION 'Your bid of % is not high enough. Minimum next bid is %.', p_bid_amount, min_next_bid;
    END IF;

    -- 6. Insert the new bid
    INSERT INTO public.bids (item_id, user_id, bid_amount)
    VALUES (p_item_id, current_user_id, p_bid_amount)
    RETURNING * INTO new_bid;

    -- The trigger 'on_new_bid_insert' on 'bids' table will automatically update
    -- 'items.current_highest_bid_id', 'items.current_bid_amount', and 'items.bid_count'.

    RETURN new_bid;
END;
$$;

COMMENT ON FUNCTION public.place_bid(uuid, decimal) IS 'Places a bid on an active auction item. Validates item status, auction end time, seller identity, and bid amount.';


-- Function to get bids for an item with pagination
CREATE OR REPLACE FUNCTION public.get_item_bids(
    p_item_id uuid,
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    item_id uuid,
    user_id uuid,
    bid_amount decimal,
    created_at timestamptz,
    bidder_username text,
    bidder_avatar_url text
)
LANGUAGE plpgsql
STABLE -- Indicates the function does not modify the database
SECURITY INVOKER
AS $$
DECLARE
    v_offset integer;
BEGIN
    IF p_page < 1 THEN p_page := 1; END IF;
    IF p_limit < 1 THEN p_limit := 10; END IF;
    v_offset := (p_page - 1) * p_limit;

    RETURN QUERY
    SELECT
        b.id,
        b.item_id,
        b.user_id,
        b.bid_amount,
        b.created_at,
        u.username AS bidder_username,
        u.avatar_url AS bidder_avatar_url
    FROM
        public.bids b
    JOIN
        public.profiles u ON b.user_id = u.id
    WHERE
        b.item_id = p_item_id
    ORDER BY
        b.created_at DESC -- Or b.bid_amount DESC, b.created_at ASC for highest bid first
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_item_bids(uuid, integer, integer) IS 'Retrieves paginated bids for a specific auction item, including bidder''s username and avatar.';


-- Function to process the end of an auction (simplified version)
CREATE OR REPLACE FUNCTION public.process_auction_end(
    p_item_id uuid
)
RETURNS uuid -- Returns transaction_id if successful, NULL otherwise
LANGUAGE plpgsql
SECURITY DEFINER -- Needs elevated privileges to create transactions, update item status
AS $$
DECLARE
    item_details public.items;
    winning_bid public.bids;
    new_transaction_id uuid;
BEGIN
    SELECT * INTO item_details FROM public.items WHERE id = p_item_id;

    IF item_details IS NULL THEN
        RAISE WARNING 'Item not found: %', p_item_id;
        RETURN NULL;
    END IF;

    IF item_details.selling_method != 'auction' THEN
        RAISE WARNING 'Item % is not an auction item.', p_item_id;
        RETURN NULL;
    END IF;

    IF item_details.ends_at > NOW() THEN
        RAISE WARNING 'Auction for item % has not ended yet.', p_item_id;
        RETURN NULL;
    END IF;

    -- Check if item is already inactive (e.g. processed, sold)
    -- This check depends on how you mark items as processed. Assuming is_active = false means processed or sold.
    IF NOT item_details.is_active THEN
        RAISE WARNING 'Auction for item % seems to be already processed or inactive.', p_item_id;
        -- Potentially check if a transaction already exists for this auction win
        RETURN NULL;
    END IF;

    IF item_details.current_highest_bid_id IS NULL OR item_details.current_bid_amount IS NULL THEN
        -- No bids, auction ended unsold
        UPDATE public.items
        SET is_active = false -- Or a specific status like 'unsold' if you add such a status column
        WHERE id = p_item_id;

        -- Notify seller: Auction ended with no bids (implementation of create_notification assumed)
        -- PERFORM public.create_notification(item_details.seller_id, 'Auction Ended Unsold', 'Your auction for "' || item_details.title || '" ended with no bids.');
        RAISE INFO 'Auction for item % ended with no bids.', p_item_id;
        RETURN NULL;
    END IF;

    -- Retrieve winning bid details
    SELECT * INTO winning_bid FROM public.bids WHERE id = item_details.current_highest_bid_id;

    -- Create transaction
    INSERT INTO public.transactions (item_id, buyer_id, seller_id, amount, status)
    VALUES (p_item_id, winning_bid.user_id, item_details.seller_id, item_details.current_bid_amount, 'pending') -- 'pending' implies awaiting payment
    RETURNING id INTO new_transaction_id;

    -- Update item status to inactive/sold
    UPDATE public.items
    SET is_active = false -- Or a status like 'sold_pending_payment'
    WHERE id = p_item_id;

    -- Notify winner and seller (implementation of create_notification assumed)
    -- PERFORM public.create_notification(winning_bid.user_id, 'Auction Won!', 'Congratulations! You won the auction for "' || item_details.title || '". Please proceed to payment.');
    -- PERFORM public.create_notification(item_details.seller_id, 'Auction Ended - Item Sold!', 'Your auction for "' || item_details.title || '" has ended. The winning bid was ' || item_details.current_bid_amount || '.');
    RAISE INFO 'Auction for item % processed. Winner: User %, Transaction ID: %.', p_item_id, winning_bid.user_id, new_transaction_id;

    RETURN new_transaction_id;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Error processing auction end for item %: %', p_item_id, SQLERRM;
        RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.process_auction_end(uuid) IS 'Processes a ended auction: creates a transaction for the winning bid, updates item status, and (conceptually) notifies users. Returns transaction ID.';
