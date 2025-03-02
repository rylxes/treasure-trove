-- Drop existing functions
DROP FUNCTION IF EXISTS get_saved_search_matches(uuid, timestamptz);
DROP FUNCTION IF EXISTS get_saved_searches_with_alerts();

-- Create a simpler function to count matching items
CREATE OR REPLACE FUNCTION count_matching_items(
  search_query text DEFAULT '',
  search_filters jsonb DEFAULT '{}'::jsonb,
  since_time timestamptz DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count bigint;
  query_text text := 'SELECT COUNT(*) FROM items WHERE is_active = true';
BEGIN
  -- Add query condition
  IF search_query != '' THEN
    query_text := query_text || format(
      ' AND (title ILIKE %L OR description ILIKE %L)',
      '%' || search_query || '%',
      '%' || search_query || '%'
    );
  END IF;

  -- Add category filter
  IF search_filters ? 'category' AND search_filters->>'category' != '' THEN
    query_text := query_text || format(
      ' AND category_id = (SELECT id FROM categories WHERE slug = %L)',
      search_filters->>'category'
    );
  END IF;

  -- Add price filters
  IF search_filters ? 'minPrice' AND search_filters->>'minPrice' != '' THEN
    query_text := query_text || format(
      ' AND price >= %s',
      search_filters->>'minPrice'
    );
  END IF;

  IF search_filters ? 'maxPrice' AND search_filters->>'maxPrice' != '' THEN
    query_text := query_text || format(
      ' AND price <= %s',
      search_filters->>'maxPrice'
    );
  END IF;

  -- Add condition filter
  IF search_filters ? 'condition' AND search_filters->>'condition' != '' THEN
    query_text := query_text || format(
      ' AND condition = %L',
      search_filters->>'condition'
    );
  END IF;

  -- Add time filter if provided
  IF since_time IS NOT NULL THEN
    query_text := query_text || format(
      ' AND created_at > %L',
      since_time
    );
  END IF;

  -- Execute the query
  EXECUTE query_text INTO total_count;
  RETURN total_count;
END;
$$;

-- Create the get_saved_searches_with_alerts function - simpler version
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
LANGUAGE sql
SECURITY DEFINER
AS $$
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
    count_matching_items(ss.query, ss.filters) AS match_count
  FROM saved_searches ss
  WHERE ss.user_id = auth.uid()
  ORDER BY ss.created_at DESC;
$$;

-- Create a function to get matching items without dynamic SQL
CREATE OR REPLACE FUNCTION get_matching_items(
  search_id uuid,
  max_results integer DEFAULT 50,
  since_time timestamptz DEFAULT NULL
)
RETURNS SETOF items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_record record;
  query_text text;
BEGIN
  -- Get the saved search
  SELECT * INTO search_record FROM saved_searches WHERE id = search_id;

  -- If no search found, return empty set
  IF search_record IS NULL THEN
    RETURN;
  END IF;

  -- Start building the query
  query_text := 'SELECT * FROM items WHERE is_active = true';

  -- Add query condition
  IF search_record.query != '' THEN
    query_text := query_text || format(
      ' AND (title ILIKE %L OR description ILIKE %L)',
      '%' || search_record.query || '%',
      '%' || search_record.query || '%'
    );
  END IF;

  -- Add category filter
  IF search_record.filters ? 'category' AND search_record.filters->>'category' != '' THEN
    query_text := query_text || format(
      ' AND category_id = (SELECT id FROM categories WHERE slug = %L)',
      search_record.filters->>'category'
    );
  END IF;

  -- Add price filters
  IF search_record.filters ? 'minPrice' AND search_record.filters->>'minPrice' != '' THEN
    query_text := query_text || format(
      ' AND price >= %s',
      search_record.filters->>'minPrice'
    );
  END IF;

  IF search_record.filters ? 'maxPrice' AND search_record.filters->>'maxPrice' != '' THEN
    query_text := query_text || format(
      ' AND price <= %s',
      search_record.filters->>'maxPrice'
    );
  END IF;

  -- Add condition filter
  IF search_record.filters ? 'condition' AND search_record.filters->>'condition' != '' THEN
    query_text := query_text || format(
      ' AND condition = %L',
      search_record.filters->>'condition'
    );
  END IF;

  -- Add time filter if provided
  IF since_time IS NOT NULL THEN
    query_text := query_text || format(
      ' AND created_at > %L',
      since_time
    );
  END IF;

  -- Add order and limit
  query_text := query_text || format(
    ' ORDER BY created_at DESC LIMIT %s',
    max_results
  );

  -- Return the query results
  RETURN QUERY EXECUTE query_text;
END;
$$;