-- Add donation organizations table
CREATE TABLE donation_organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  contact_info jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add donation status to items
ALTER TABLE items
ADD COLUMN donation_status text CHECK (donation_status IN ('not_donated', 'pending', 'donated')),
ADD COLUMN donation_org_id uuid REFERENCES donation_organizations(id),
ADD COLUMN donation_requested_at timestamptz;

-- Set default value for existing items
UPDATE items SET donation_status = 'not_donated' WHERE donation_status IS NULL;
ALTER TABLE items ALTER COLUMN donation_status SET DEFAULT 'not_donated';

-- Function to request donation
CREATE OR REPLACE FUNCTION request_item_donation(
  item_id uuid,
  org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM items i
    WHERE i.id = request_item_donation.item_id
    AND i.seller_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to donate this item';
  END IF;

  UPDATE items
  SET
    donation_status = 'pending',
    donation_org_id = org_id,
    donation_requested_at = now()
  WHERE id = item_id;
END;
$$;

-- Function to get available donation organizations
CREATE OR REPLACE FUNCTION get_donation_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  contact_info jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, name, description, contact_info
  FROM donation_organizations
  WHERE is_active = true
  ORDER BY name;
$$;