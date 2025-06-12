-- Create bids table for auction items
CREATE TABLE public.bids (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Bidder
    bid_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bids IS 'Stores bids placed by users on auction items.';

-- RLS Policies for bids table
CREATE POLICY "Public can view bids on active auction items"
  ON public.bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = bids.item_id AND items.is_active = true AND items.selling_method = 'auction'
    )
  );

CREATE POLICY "Authenticated users can insert bids on active auction items"
  ON public.bids FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = bids.item_id AND items.is_active = true AND items.selling_method = 'auction' AND items.ends_at > NOW()
    )
    -- Additional check in place_bid function will ensure bid_amount is valid
  );

-- Users should generally not be able to update or delete bids directly once placed.
-- If a bid needs to be cancelled, it would typically be a special admin/moderator action or not allowed.


-- Add columns to items table to track auction status
ALTER TABLE public.items
ADD COLUMN current_highest_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL, -- If a bid is deleted (rare), set this to null
ADD COLUMN current_bid_amount DECIMAL(10,2),
ADD COLUMN bid_count INT DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.items.current_highest_bid_id IS 'Reference to the current highest bid for an auction item.';
COMMENT ON COLUMN public.items.current_bid_amount IS 'The amount of the current highest bid for an auction item.';
COMMENT ON COLUMN public.items.bid_count IS 'The total number of bids placed on an auction item.';


-- Function to update item''s auction fields after a new bid is inserted
CREATE OR REPLACE FUNCTION public.update_item_auction_details_on_new_bid()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current_bid_amount, current_highest_bid_id, and bid_count on the item.
  -- The actual validation that NEW.bid_amount is higher than previous bids
  -- should ideally be in the place_bid function before inserting the bid.
  -- This trigger assumes the inserted bid is valid and is the new highest.
  UPDATE public.items
  SET
    current_bid_amount = NEW.bid_amount,
    current_highest_bid_id = NEW.id,
    bid_count = (SELECT COUNT(*) FROM public.bids WHERE item_id = NEW.item_id) -- Recalculate count
  WHERE items.id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER might be needed if RLS on items prevents direct update

-- Trigger on bids table
CREATE TRIGGER on_new_bid_insert
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_auction_details_on_new_bid();

-- Initialize current_bid_amount for existing auction items if any (unlikely for a new schema part)
-- For new auctions, current_bid_amount will be null, and items.price is starting price.
-- When first bid comes, current_bid_amount gets populated.

-- Consider edge case: if a bid is deleted (manual admin action, not typical user flow)
-- We might need another trigger on DELETE of bids, or adjust the place_bid logic
-- to find the next highest bid if the current highest is deleted.
-- For now, this trigger focuses on INSERT. Deleting bids is a more complex scenario.
-- The `ON DELETE SET NULL` for `current_highest_bid_id` handles the FK integrity if a bid is deleted.
-- A function could then be run to find the new highest bid.
