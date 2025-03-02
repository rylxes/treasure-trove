-- Migration: Add Enhanced Saved Searches with Alerts

-- Modify saved_searches table to add alert functionality
ALTER TABLE saved_searches
ADD COLUMN alert_enabled boolean DEFAULT false,
ADD COLUMN last_alert_sent timestamptz,
ADD COLUMN alert_frequency text DEFAULT 'daily'
  CHECK (alert_frequency IN ('daily', 'weekly', 'instant'));

-- Create function to get matching items for a saved search
CREATE OR REPLACE FUNCTION get_saved_search_matches(
  search_id uuid,
  since_timestamp timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  price decimal,
  condition text,
  images text[],
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_record record;
  query_condition text := '';
  filter_conditions text := '';
BEGIN
  -- Get the saved search
  SELECT * INTO search_record FROM saved_searches WHERE id = search_id;

  -- If no search found, return empty set
  IF search_record IS NULL THEN
    RETURN;
  END IF;

  -- Build the query condition for text search
  IF search_record.query != '' THEN
    query_condition := format(
      'AND (title ILIKE %L OR description ILIKE %L)',
      '%' || search_record.query || '%',
      '%' || search_record.query || '%'
    );
  END IF;

  -- Build filter conditions from JSON
  IF search_record.filters ? 'category' AND search_record.filters->>'category' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND category_id = (SELECT id FROM categories WHERE slug = %L)',
      search_record.filters->>'category'
    );
  END IF;

  IF search_record.filters ? 'minPrice' AND search_record.filters->>'minPrice' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND price >= %s',
      search_record.filters->>'minPrice'
    );
  END IF;

  IF search_record.filters ? 'maxPrice' AND search_record.filters->>'maxPrice' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND price <= %s',
      search_record.filters->>'maxPrice'
    );
  END IF;

  IF search_record.filters ? 'condition' AND search_record.filters->>'condition' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND condition = %L',
      search_record.filters->>'condition'
    );
  END IF;

  -- Add timestamp condition if provided
  IF since_timestamp IS NOT NULL THEN
    filter_conditions := filter_conditions || format(
      ' AND created_at > %L',
      since_timestamp
    );
  END IF;

  -- Build and execute the final query
  RETURN QUERY EXECUTE format(
    'SELECT id, title, price, condition, images, created_at FROM items
     WHERE is_active = true %s %s
     ORDER BY created_at DESC',
    query_condition,
    filter_conditions
  );
END;
$$;

-- Function to process saved search alerts
CREATE OR REPLACE FUNCTION process_saved_search_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_record record;
  matches_count integer;
  alert_window timestamptz;
  user_id uuid;
BEGIN
  -- Process each saved search with alerts enabled
  FOR search_record IN
    SELECT ss.*, p.id as user_id
    FROM saved_searches ss
    JOIN profiles p ON ss.user_id = p.id
    WHERE ss.alert_enabled = true
      AND (
        ss.last_alert_sent IS NULL
        OR (
          ss.alert_frequency = 'daily' AND ss.last_alert_sent < now() - interval '1 day'
          OR ss.alert_frequency = 'weekly' AND ss.last_alert_sent < now() - interval '7 days'
        )
      )
  LOOP
    user_id := search_record.user_id;

    -- Determine time window based on alert frequency and last alert
    IF search_record.last_alert_sent IS NULL THEN
      -- For new alerts, check items from the last 7 days
      alert_window := now() - interval '7 days';
    ELSE
      -- For existing alerts, check items since the last alert
      alert_window := search_record.last_alert_sent;
    END IF;

    -- Count new matches
    SELECT count(*) INTO matches_count
    FROM get_saved_search_matches(search_record.id, alert_window);

    -- If there are new matches, send a notification
    IF matches_count > 0 THEN
      -- Create notification
      INSERT INTO notifications (
        user_id,
        title,
        content,
        read
      )
      VALUES (
        user_id,
        'New Items for Your Saved Search',
        format(
          'Found %s new item(s) matching your saved search "%s"',
          matches_count,
          search_record.name
        ),
        false
      );

      -- Update last_alert_sent
      UPDATE saved_searches
      SET last_alert_sent = now()
      WHERE id = search_record.id;

      -- Send email notification
      IF search_record.notify_email THEN
        -- Use your email notification system here
        -- This is a placeholder for the actual implementation
        PERFORM 1;
      END IF;

      -- Send push notification
      IF search_record.notify_push THEN
        -- Use your push notification system here
        -- This is a placeholder for the actual implementation
        PERFORM 1;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function to toggle saved search alerts
CREATE OR REPLACE FUNCTION toggle_saved_search_alert(
  search_id uuid,
  enable boolean DEFAULT true,
  frequency text DEFAULT 'daily'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user owns the saved search
  IF NOT EXISTS (
    SELECT 1 FROM saved_searches
    WHERE id = search_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify this saved search';
  END IF;

  -- Update the saved search
  UPDATE saved_searches
  SET
    alert_enabled = enable,
    alert_frequency = frequency,
    last_alert_sent = CASE WHEN enable THEN NULL ELSE last_alert_sent END
  WHERE id = search_id;
END;
$$;

-- Function to get saved searches with extra info about alerts
CREATE OR REPLACE FUNCTION get_saved_searches_with_alerts()
RETURNS TABLE (
  id uuid,
  name text,
  query text,
  filters jsonb,
  notify_email boolean,
  notify_push boolean,
  alert_enabled boolean,
  alert_frequency text,
  created_at timestamptz,
  match_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.id,
    ss.name,
    ss.query,
    ss.filters,
    ss.notify_email,
    ss.notify_push,
    ss.alert_enabled,
    ss.alert_frequency,
    ss.created_at,
    (SELECT count(*) FROM get_saved_search_matches(ss.id))
  FROM saved_searches ss
  WHERE ss.user_id = auth.uid()
  ORDER BY ss.created_at DESC;
END;
$$;