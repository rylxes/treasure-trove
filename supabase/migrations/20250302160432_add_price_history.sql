-- Migration: Add Price Drop Alerts Feature

-- Create price history table to track price changes
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  old_price decimal(10,2) NOT NULL,
  new_price decimal(10,2) NOT NULL,
  changed_at timestamptz DEFAULT now()
);

-- Create price alerts table
CREATE TABLE price_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  target_price decimal(10,2), -- Optional target price (if null, alert on any drop)
  created_at timestamptz DEFAULT now(),
  last_notified_at timestamptz,
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT true,
  UNIQUE(user_id, item_id)
);

-- Enable RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin can manage price history"
  ON price_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can view price history"
  ON price_history FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their price alerts"
  ON price_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check if an item has a price alert
CREATE OR REPLACE FUNCTION has_price_alert(item_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM price_alerts
    WHERE user_id = auth.uid()
    AND item_id = has_price_alert.item_id
  );
$$;

-- Function to toggle price alert
CREATE OR REPLACE FUNCTION toggle_price_alert(
  item_id uuid,
  target_price decimal DEFAULT NULL,
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alert_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM price_alerts
    WHERE user_id = auth.uid()
    AND item_id = toggle_price_alert.item_id
  ) INTO alert_exists;

  IF alert_exists THEN
    -- Remove existing alert
    DELETE FROM price_alerts
    WHERE user_id = auth.uid()
    AND item_id = toggle_price_alert.item_id;
    RETURN false;
  ELSE
    -- Create new alert
    INSERT INTO price_alerts (
      user_id,
      item_id,
      target_price,
      notify_email,
      notify_push
    )
    VALUES (
      auth.uid(),
      toggle_price_alert.item_id,
      toggle_price_alert.target_price,
      toggle_price_alert.notify_email,
      toggle_price_alert.notify_push
    );
    RETURN true;
  END IF;
END;
$$;

-- Function to get user's price alerts
CREATE OR REPLACE FUNCTION get_price_alerts(limit_val int DEFAULT 50, offset_val int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  item_id uuid,
  title text,
  current_price decimal,
  target_price decimal,
  images text[],
  created_at timestamptz,
  notify_email boolean,
  notify_push boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    pa.id,
    i.id as item_id,
    i.title,
    i.price as current_price,
    pa.target_price,
    i.images,
    pa.created_at,
    pa.notify_email,
    pa.notify_push
  FROM price_alerts pa
  JOIN items i ON pa.item_id = i.id
  WHERE pa.user_id = auth.uid()
    AND i.is_active = true
  ORDER BY pa.created_at DESC
  LIMIT limit_val
  OFFSET offset_val;
$$;

-- Trigger to track price changes
CREATE OR REPLACE FUNCTION track_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only track actual price changes
  IF OLD.price != NEW.price THEN
    INSERT INTO price_history (
      item_id,
      old_price,
      new_price
    )
    VALUES (
      NEW.id,
      OLD.price,
      NEW.price
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to items table
DROP TRIGGER IF EXISTS items_price_change_trigger ON items;
CREATE TRIGGER items_price_change_trigger
AFTER UPDATE OF price ON items
FOR EACH ROW
EXECUTE FUNCTION track_price_change();

-- Function to process price drop notifications
CREATE OR REPLACE FUNCTION process_price_drop_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  price_change record;
  alert record;
BEGIN
  -- Get recent price drops (last 24 hours)
  FOR price_change IN
    SELECT ph.item_id, i.title, ph.old_price, ph.new_price
    FROM price_history ph
    JOIN items i ON ph.item_id = i.id
    WHERE ph.changed_at > now() - interval '24 hours'
      AND ph.new_price < ph.old_price -- Price dropped
      AND i.is_active = true
  LOOP
    -- Find users who have alerts for this item
    FOR alert IN
      SELECT pa.id, pa.user_id, pa.target_price, pa.notify_email, pa.notify_push
      FROM price_alerts pa
      WHERE pa.item_id = price_change.item_id
        AND (
          pa.target_price IS NULL -- Alert on any drop
          OR price_change.new_price <= pa.target_price -- Price reached target
        )
        AND (
          pa.last_notified_at IS NULL -- Never notified
          OR pa.last_notified_at < now() - interval '7 days' -- Don't spam notifications
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
        'Price Drop Alert',
        format(
          'Price dropped for "%s" from $%s to $%s',
          price_change.title,
          price_change.old_price,
          price_change.new_price
        ),
        false
      );

      -- Update last_notified_at
      UPDATE price_alerts
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