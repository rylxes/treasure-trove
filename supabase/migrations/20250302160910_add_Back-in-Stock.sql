-- Migration: Add Back-in-Stock Notifications Feature

-- Add stock_status to items table
ALTER TABLE items
ADD COLUMN stock_status text NOT NULL DEFAULT 'in_stock'
CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock'));

-- Create stock alerts table
CREATE TABLE stock_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_notified_at timestamptz,
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT true,
  UNIQUE(user_id, item_id)
);

-- Create stock change history table
CREATE TABLE stock_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  old_status text NOT NULL,
  new_status text NOT NULL,
  changed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their stock alerts"
  ON stock_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view stock history"
  ON stock_history FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage stock history"
  ON stock_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Function to check if an item has a stock alert
CREATE OR REPLACE FUNCTION has_stock_alert(item_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM stock_alerts
    WHERE user_id = auth.uid()
    AND item_id = has_stock_alert.item_id
  );
$$;

-- Function to toggle stock alert
CREATE OR REPLACE FUNCTION toggle_stock_alert(
  item_id uuid,
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alert_exists boolean;
  item_status text;
BEGIN
  -- Check if alert already exists
  SELECT EXISTS (
    SELECT 1 FROM stock_alerts
    WHERE user_id = auth.uid()
    AND item_id = toggle_stock_alert.item_id
  ) INTO alert_exists;

  -- Get item status
  SELECT stock_status INTO item_status
  FROM items
  WHERE id = toggle_stock_alert.item_id;

  IF alert_exists THEN
    -- Remove existing alert
    DELETE FROM stock_alerts
    WHERE user_id = auth.uid()
    AND item_id = toggle_stock_alert.item_id;
    RETURN false;
  ELSE
    -- Check if item is out of stock (only allow alerts for out of stock items)
    IF item_status != 'out_of_stock' THEN
      RAISE EXCEPTION 'Cannot set alert for in-stock item';
    END IF;

    -- Create new alert
    INSERT INTO stock_alerts (
      user_id,
      item_id,
      notify_email,
      notify_push
    )
    VALUES (
      auth.uid(),
      toggle_stock_alert.item_id,
      toggle_stock_alert.notify_email,
      toggle_stock_alert.notify_push
    );
    RETURN true;
  END IF;
END;
$$;

-- Function to get user's stock alerts
CREATE OR REPLACE FUNCTION get_stock_alerts(limit_val int DEFAULT 50, offset_val int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  item_id uuid,
  title text,
  stock_status text,
  price decimal,
  images text[],
  created_at timestamptz,
  notify_email boolean,
  notify_push boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    sa.id,
    i.id as item_id,
    i.title,
    i.stock_status,
    i.price,
    i.images,
    sa.created_at,
    sa.notify_email,
    sa.notify_push
  FROM stock_alerts sa
  JOIN items i ON sa.item_id = i.id
  WHERE sa.user_id = auth.uid()
    AND i.is_active = true
  ORDER BY sa.created_at DESC
  LIMIT limit_val
  OFFSET offset_val;
$$;

-- Trigger to track stock status changes
CREATE OR REPLACE FUNCTION track_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only track actual status changes
  IF OLD.stock_status != NEW.stock_status THEN
    INSERT INTO stock_history (
      item_id,
      old_status,
      new_status
    )
    VALUES (
      NEW.id,
      OLD.stock_status,
      NEW.stock_status
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to items table
DROP TRIGGER IF EXISTS items_stock_change_trigger ON items;
CREATE TRIGGER items_stock_change_trigger
AFTER UPDATE OF stock_status ON items
FOR EACH ROW
EXECUTE FUNCTION track_stock_change();

-- Function to process back-in-stock notifications
CREATE OR REPLACE FUNCTION process_stock_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stock_change record;
  alert record;
BEGIN
  -- Get recent back-in-stock items (last 24 hours)
  FOR stock_change IN
    SELECT sh.item_id, i.title, sh.old_status, sh.new_status
    FROM stock_history sh
    JOIN items i ON sh.item_id = i.id
    WHERE sh.changed_at > now() - interval '24 hours'
      AND sh.old_status = 'out_of_stock'
      AND sh.new_status = 'in_stock'
      AND i.is_active = true
  LOOP
    -- Find users who have alerts for this item
    FOR alert IN
      SELECT sa.id, sa.user_id, sa.notify_email, sa.notify_push
      FROM stock_alerts sa
      WHERE sa.item_id = stock_change.item_id
        AND (
          sa.last_notified_at IS NULL -- Never notified
          OR sa.last_notified_at < now() - interval '7 days' -- Don't spam notifications
        )
    LOOP
      -- Create notification
      INSERT INTO notifications (
        user_id,
        title,
        content,
        read
      )
      VALUES (
        alert.user_id,
        'Back in Stock Alert',
        format(
          '"%s" is back in stock!',
          stock_change.title
        ),
        false
      );

      -- Update last_notified_at
      UPDATE stock_alerts
      SET last_notified_at = now()
      WHERE id = alert.id;

      -- Send email notification
      IF alert.notify_email THEN
        -- Use your email notification system here
        -- This is a placeholder for the actual implementation
        PERFORM 1;
      END IF;

      -- Send push notification
      IF alert.notify_push THEN
        -- Use your push notification system here
        -- This is a placeholder for the actual implementation
        PERFORM 1;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Update item functions to handle stock status
CREATE OR REPLACE FUNCTION update_item_stock_status(
  item_id uuid,
  new_stock_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is the seller or admin
  IF NOT EXISTS (
    SELECT 1 FROM items i
    WHERE i.id = update_item_stock_status.item_id
    AND (
      i.seller_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to update item stock status';
  END IF;

  -- Update stock status
  UPDATE items
  SET
    stock_status = new_stock_status,
    updated_at = now()
  WHERE id = update_item_stock_status.item_id;
END;
$$;