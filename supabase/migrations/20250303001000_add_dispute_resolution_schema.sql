-- Define ENUM types for dispute reason and status for consistency (optional, TEXT is also fine)
CREATE TYPE dispute_reason_type AS ENUM (
    'item_not_as_described',
    'item_not_received',
    'payment_issue',
    'seller_unresponsive',
    'buyer_unresponsive',
    'other'
);

CREATE TYPE dispute_status_type AS ENUM (
    'open', -- Newly opened by user
    'awaiting_seller_response', -- User opened, waiting for seller
    'awaiting_buyer_response', -- Seller responded, waiting for buyer (or vice-versa)
    'under_admin_review', -- Escalated to admin
    'resolved_favor_buyer',
    'resolved_favor_seller',
    'resolved_amicably', -- Mutual agreement
    'closed_withdrawn', -- Initiator withdrew
    'closed_other'
);

-- Create disputes table
CREATE TABLE public.disputes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT, -- Disputes are tied to transactions
    created_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- User who initiated
    reason dispute_reason_type NOT NULL,
    description TEXT NOT NULL, -- Detailed explanation from initiator
    status dispute_status_type NOT NULL DEFAULT 'open',
    resolution_details TEXT NULL, -- How the dispute was resolved
    resolved_by_admin_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- Admin who resolved it
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.disputes IS 'Stores information about disputes raised by users regarding transactions.';

-- RLS Policies for disputes
CREATE POLICY "Users can view disputes they are involved in"
  ON public.disputes FOR SELECT
  USING (
    auth.uid() = created_by_user_id OR
    EXISTS ( -- Check if user is buyer or seller in the linked transaction
      SELECT 1 FROM public.transactions t
      WHERE t.id = disputes.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    -- Or if user is an admin (admin check to be handled by API security or function logic)
  );

CREATE POLICY "Users can create disputes for their transactions"
  ON public.disputes FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_user_id AND
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = disputes.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- Only specific roles (e.g. admin) or backend functions should update status/resolution_details.
-- Users involved might update it to certain statuses like 'awaiting_X_response'.
CREATE POLICY "Users involved can update certain aspects of a dispute (e.g. add info - handled by functions)"
  ON public.disputes FOR UPDATE
  USING (
    auth.uid() = created_by_user_id OR
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = disputes.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    -- More granular checks needed here, typically done in helper functions or by restricting updatable columns
    -- For instance, a user should not be able to set status to 'resolved_favor_buyer'
    -- This RLS policy is intentionally broad for direct updates by users;
    -- however, critical status changes should be managed by specific, secure functions.
    -- Example: Allow user to update description if they created it and status is 'open'
    (created_by_user_id = auth.uid() AND status = 'open') OR
    -- Or allow specific status transitions by involved parties (complex to define exhaustively in RLS)
    (auth.uid() IN (created_by_user_id, (SELECT t.buyer_id FROM public.transactions t WHERE t.id = disputes.transaction_id), (SELECT t.seller_id FROM public.transactions t WHERE t.id = disputes.transaction_id))
     AND status IN ('awaiting_buyer_response', 'awaiting_seller_response'))
  );
-- RLS for updates will be more practically managed by specific functions for critical fields.


-- Create dispute_messages table
CREATE TABLE public.dispute_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- Sender of the message
    message_text TEXT NOT NULL,
    attachment_url TEXT NULL, -- Optional URL for evidence/attachments
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.dispute_messages IS 'Stores messages exchanged during a dispute resolution process.';

-- RLS Policies for dispute_messages
CREATE POLICY "Users involved in a dispute can view its messages"
  ON public.dispute_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_messages.dispute_id AND
      (
        d.created_by_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = d.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
        )
      )
    )
    -- Or admin access
  );

CREATE POLICY "Users involved in a dispute can add messages"
  ON public.dispute_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND -- Message sender must be the current user
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_messages.dispute_id AND
      (
        d.created_by_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = d.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
        )
      )
      -- And dispute must be in an open/active status to add messages
      AND d.status NOT IN ('resolved_favor_buyer', 'resolved_favor_seller', 'resolved_amicably', 'closed_withdrawn', 'closed_other')
    )
  );

-- Trigger to update disputes.updated_at when a new message is added
CREATE OR REPLACE FUNCTION public.update_dispute_updated_at_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.disputes
    SET updated_at = NOW()
    WHERE id = NEW.dispute_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_dispute_message
  AFTER INSERT ON public.dispute_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dispute_updated_at_on_new_message();

-- Trigger to update disputes.updated_at when a dispute itself is updated
CREATE OR REPLACE FUNCTION public.update_dispute_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_dispute_update
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dispute_updated_at();
