-- Fix for the ambiguous "id" column error
-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_saved_searches_with_alerts();

-- Create the updated function with explicit column references
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