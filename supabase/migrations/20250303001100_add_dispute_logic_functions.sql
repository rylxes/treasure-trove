-- Function for a user to open a new dispute for a transaction
CREATE OR REPLACE FUNCTION public.open_dispute(
    p_transaction_id uuid,
    p_reason dispute_reason_type,
    p_description text
)
RETURNS public.disputes -- Returns the newly created dispute record
LANGUAGE plpgsql
SECURITY INVOKER -- Runs as the calling user; RLS on `disputes` table handles insert permission.
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    transaction_info record;
    new_dispute public.disputes;
    initial_status dispute_status_type := 'open';
BEGIN
    -- Validate user is part of the transaction
    SELECT t.buyer_id, t.seller_id INTO transaction_info
    FROM public.transactions t
    WHERE t.id = p_transaction_id;

    IF transaction_info IS NULL THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    IF current_user_id != transaction_info.buyer_id AND current_user_id != transaction_info.seller_id THEN
        RAISE EXCEPTION 'You are not a party to this transaction and cannot open a dispute.';
    END IF;

    -- Determine initial status based on who is opening and who is the other party
    IF current_user_id = transaction_info.buyer_id THEN
        initial_status := 'awaiting_seller_response';
    ELSIF current_user_id = transaction_info.seller_id THEN
        initial_status := 'awaiting_buyer_response';
    END IF;

    -- Check if a dispute already exists for this transaction
    IF EXISTS (SELECT 1 FROM public.disputes WHERE transaction_id = p_transaction_id) THEN
        RAISE EXCEPTION 'A dispute already exists for this transaction.';
    END IF;

    INSERT INTO public.disputes (transaction_id, created_by_user_id, reason, description, status)
    VALUES (p_transaction_id, current_user_id, p_reason, p_description, initial_status)
    RETURNING * INTO new_dispute;

    RETURN new_dispute;
END;
$$;
COMMENT ON FUNCTION public.open_dispute(uuid, dispute_reason_type, text) IS 'Opens a new dispute for a transaction by one of its participants.';


-- Function for a user to add a message to an existing dispute
CREATE OR REPLACE FUNCTION public.add_dispute_message(
    p_dispute_id uuid,
    p_message_text text,
    p_attachment_url text DEFAULT NULL
)
RETURNS public.dispute_messages -- Returns the newly created message
LANGUAGE plpgsql
SECURITY INVOKER -- RLS on `dispute_messages` handles insert permission.
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    dispute_info public.disputes;
    transaction_info record;
    new_message public.dispute_messages;
BEGIN
    -- Fetch dispute details to check status and involvement
    SELECT * INTO dispute_info FROM public.disputes WHERE id = p_dispute_id;
    IF dispute_info IS NULL THEN
        RAISE EXCEPTION 'Dispute not found.';
    END IF;

    -- Fetch transaction to verify user involvement (redundant if RLS is perfect, but good for function integrity)
    SELECT t.buyer_id, t.seller_id INTO transaction_info
    FROM public.transactions t
    WHERE t.id = dispute_info.transaction_id;

    IF current_user_id != dispute_info.created_by_user_id AND
       current_user_id != transaction_info.buyer_id AND
       current_user_id != transaction_info.seller_id THEN
        RAISE EXCEPTION 'You are not authorized to add messages to this dispute.';
    END IF;

    -- Check if dispute is in a state that allows new messages
    IF dispute_info.status IN ('resolved_favor_buyer', 'resolved_favor_seller', 'resolved_amicably', 'closed_withdrawn', 'closed_other') THEN
        RAISE EXCEPTION 'This dispute is closed and no longer accepts new messages.';
    END IF;

    INSERT INTO public.dispute_messages (dispute_id, user_id, message_text, attachment_url)
    VALUES (p_dispute_id, current_user_id, p_message_text, p_attachment_url)
    RETURNING * INTO new_message;

    -- The trigger 'on_new_dispute_message' on 'dispute_messages' will update 'disputes.updated_at'.

    RETURN new_message;
END;
$$;
COMMENT ON FUNCTION public.add_dispute_message(uuid, text, text) IS 'Adds a message to an active dispute by an involved participant.';


-- Function to get details of a specific dispute (including messages)
-- This is a bit more complex due to returning multiple structures (dispute details + array of messages).
-- One way is to return JSON, another is multiple SETOF records, or define a custom composite type.
-- For simplicity with Supabase RPC, returning JSON might be easiest for the client.
CREATE OR REPLACE FUNCTION public.get_dispute_details(p_dispute_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER -- RLS on disputes and dispute_messages will apply.
AS $$
DECLARE
    dispute_data JSONB;
    messages_data JSONB;
    current_user_id uuid := auth.uid();
    is_involved BOOLEAN := FALSE;
    dispute_record public.disputes;
    transaction_record public.transactions;
BEGIN
    SELECT * INTO dispute_record FROM public.disputes WHERE id = p_dispute_id;
    IF dispute_record IS NULL THEN
        RAISE EXCEPTION 'Dispute not found.';
    END IF;

    SELECT * INTO transaction_record FROM public.transactions WHERE id = dispute_record.transaction_id;

    -- Check involvement for RLS equivalent (RPC functions don't automatically enforce table RLS on joined data within function body before return)
    IF dispute_record.created_by_user_id = current_user_id OR
       transaction_record.buyer_id = current_user_id OR
       transaction_record.seller_id = current_user_id
    THEN
        is_involved := TRUE;
    END IF;

    -- Consider admin role override for is_involved if you have an admin check function like is_admin()
    -- IF is_admin() THEN is_involved := TRUE; END IF;


    IF NOT is_involved THEN
        RAISE EXCEPTION 'You are not authorized to view this dispute.';
    END IF;

    -- Build dispute data (excluding messages for now)
    dispute_data := jsonb_build_object(
        'id', dispute_record.id,
        'transaction_id', dispute_record.transaction_id,
        'created_by_user_id', dispute_record.created_by_user_id,
        'reason', dispute_record.reason,
        'description', dispute_record.description,
        'status', dispute_record.status,
        'resolution_details', dispute_record.resolution_details,
        'resolved_by_admin_id', dispute_record.resolved_by_admin_id,
        'created_at', dispute_record.created_at,
        'updated_at', dispute_record.updated_at,
        'transaction_details', jsonb_build_object(
            'item_id', transaction_record.item_id, -- Consider fetching item title too
            'buyer_id', transaction_record.buyer_id,
            'seller_id', transaction_record.seller_id,
            'amount', transaction_record.amount,
            'transaction_created_at', transaction_record.created_at
        )
        -- Add profile info for created_by_user_id, buyer_id, seller_id
    );

    -- Aggregate messages
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', dm.id,
            'user_id', dm.user_id,
            'message_text', dm.message_text,
            'attachment_url', dm.attachment_url,
            'created_at', dm.created_at,
            'sender_username', (SELECT p.username FROM public.profiles p WHERE p.id = dm.user_id)
        ) ORDER BY dm.created_at ASC
    ) INTO messages_data
    FROM public.dispute_messages dm
    WHERE dm.dispute_id = p_dispute_id;

    RETURN jsonb_set(dispute_data, '{messages}', COALESCE(messages_data, '[]'::jsonb));
END;
$$;
COMMENT ON FUNCTION public.get_dispute_details(uuid) IS 'Retrieves detailed information for a specific dispute, including its messages and participant details, if the caller is involved or an admin.';


-- Function for a user to get a list of their disputes (paginated)
CREATE OR REPLACE FUNCTION public.get_user_disputes(
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    transaction_id uuid,
    item_id uuid, -- Added for convenience
    item_title text, -- Added for convenience
    reason dispute_reason_type,
    description text,
    status dispute_status_type,
    created_at timestamptz,
    updated_at timestamptz,
    other_party_username text -- Username of the other party in the transaction
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    v_offset integer;
BEGIN
    IF p_page < 1 THEN p_page := 1; END IF;
    IF p_limit < 1 THEN p_limit := 10; END IF;
    v_offset := (p_page - 1) * p_limit;

    RETURN QUERY
    SELECT
        d.id,
        d.transaction_id,
        t.item_id,
        (SELECT i.title FROM public.items i WHERE i.id = t.item_id) as item_title,
        d.reason,
        d.description,
        d.status,
        d.created_at,
        d.updated_at,
        CASE
            WHEN t.buyer_id = current_user_id THEN (SELECT p_seller.username FROM public.profiles p_seller WHERE p_seller.id = t.seller_id)
            WHEN t.seller_id = current_user_id THEN (SELECT p_buyer.username FROM public.profiles p_buyer WHERE p_buyer.id = t.buyer_id)
            ELSE NULL -- Should not happen if user is creator or party to transaction
        END AS other_party_username
    FROM public.disputes d
    JOIN public.transactions t ON d.transaction_id = t.id
    WHERE
        d.created_by_user_id = current_user_id OR
        t.buyer_id = current_user_id OR
        t.seller_id = current_user_id
    ORDER BY d.updated_at DESC
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;
COMMENT ON FUNCTION public.get_user_disputes(integer, integer) IS 'Retrieves a paginated list of disputes the current user is involved in (as creator, buyer, or seller).';
