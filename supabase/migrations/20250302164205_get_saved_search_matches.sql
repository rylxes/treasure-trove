-- First, fix get_saved_search_matches function which is causing issues

DROP FUNCTION IF EXISTS get_saved_search_matches(uuid, timestamptz);

CREATE OR REPLACE FUNCTION get_saved_search_matches(
  search_id uuid,
  since_timestamp timestamptz DEFAULT NULL
)
RETURNS TABLE (
  item_id uuid,
  item_title text,
  item_price decimal,
  item_condition text,
  item_images text[],
  item_created_at timestamptz
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
  SELECT * INTO search_record FROM saved_searches WHERE saved_searches.id = search_id;

  -- If no search found, return empty set
  IF search_record IS NULL THEN
    RETURN;
  END IF;

  -- Build the query condition for text search
  IF search_record.query != '' THEN
    query_condition := format(
      'AND (items.title ILIKE %L OR items.description ILIKE %L)',
      '%' || search_record.query || '%',
      '%' || search_record.query || '%'
    );
  END IF;

  -- Build filter conditions from JSON
  IF search_record.filters ? 'category' AND search_record.filters->>'category' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND items.category_id = (SELECT categories.id FROM categories WHERE categories.slug = %L)',
      search_record.filters->>'category'
    );
  END IF;

  IF search_record.filters ? 'minPrice' AND search_record.filters->>'minPrice' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND items.price >= %s',
      search_record.filters->>'minPrice'
    );
  END IF;

  IF search_record.filters ? 'maxPrice' AND search_record.filters->>'maxPrice' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND items.price <= %s',
      search_record.filters->>'maxPrice'
    );
  END IF;

  IF search_record.filters ? 'condition' AND search_record.filters->>'condition' != '' THEN
    filter_conditions := filter_conditions || format(
      ' AND items.condition = %L',
      search_record.filters->>'condition'
    );
  END IF;

  -- Add timestamp condition if provided
  IF since_timestamp IS NOT NULL THEN
    filter_conditions := filter_conditions || format(
      ' AND items.created_at > %L',
      since_timestamp
    );
  END IF;

  -- Build and execute the final query with explicitly named return columns
  RETURN QUERY EXECUTE format(
    'SELECT
       items.id AS item_id,
       items.title AS item_title,
       items.price AS item_price,
       items.condition AS item_condition,
       items.images AS item_images,
       items.created_at AS item_created_at
     FROM items
     WHERE items.is_active = true %s %s
     ORDER BY items.created_at DESC',
    query_condition,
    filter_conditions
  );
END;
$$;

-- Now fix the get_saved_searches_with_alerts function
DROP FUNCTION IF EXISTS get_saved_searches_with_alerts();

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
    (SELECT count(*) FROM get_saved_search_matches(ss.id)) AS match_count
  FROM saved_searches ss
  WHERE ss.user_id = auth.uid()
  ORDER BY ss.created_at DESC;
END;
$$;