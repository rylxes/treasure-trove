-- Fix for the HTTP extension error
-- This implementation provides placeholders for functions that would normally use HTTP calls

-- First, check if the HTTP extension exists and create it if possible
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Unable to create HTTP extension - creating fallback functions instead';
END $$;

-- Fallback implementation for Elasticsearch functions
-- These will work without making actual HTTP calls

-- Create or replace check_elasticsearch_connection function
CREATE OR REPLACE FUNCTION check_elasticsearch_connection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return a simulated response
  RETURN jsonb_build_object(
    'available', false,
    'status', 'disabled',
    'error', 'HTTP extension not available - using database fallback'
  );
END;
$$;

-- Create or replace test_elasticsearch_connection function
CREATE OR REPLACE FUNCTION test_elasticsearch_connection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return a simulated response
  RETURN jsonb_build_object(
    'available', false,
    'status', 'disabled',
    'error', 'HTTP extension not available - using database fallback'
  );
END;
$$;

-- Create or replace sync_item_to_elasticsearch function
CREATE OR REPLACE FUNCTION sync_item_to_elasticsearch(item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Just log the request in a table instead of making HTTP call
  -- First create a log table if it doesn't exist
  CREATE TABLE IF NOT EXISTS elasticsearch_sync_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id uuid NOT NULL,
    operation text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  -- Record the sync attempt
  INSERT INTO elasticsearch_sync_log (item_id, operation)
  VALUES (item_id, 'sync');

  -- Log message
  RAISE NOTICE 'Item % sync to Elasticsearch simulated (HTTP extension not available)', item_id;
END;
$$;

-- Create or replace delete_item_from_elasticsearch function
CREATE OR REPLACE FUNCTION delete_item_from_elasticsearch(item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Just log the request in a table instead of making HTTP call
  CREATE TABLE IF NOT EXISTS elasticsearch_sync_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id uuid NOT NULL,
    operation text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  -- Record the delete attempt
  INSERT INTO elasticsearch_sync_log (item_id, operation)
  VALUES (item_id, 'delete');

  -- Log message
  RAISE NOTICE 'Item % delete from Elasticsearch simulated (HTTP extension not available)', item_id;
END;
$$;

-- Create fallback function for searchItems that uses database search instead
CREATE OR REPLACE FUNCTION searchItems(
  query text DEFAULT '',
  filters jsonb DEFAULT '{}'::jsonb
)
RETURNS SETOF items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text text;
BEGIN
  -- Start building the query
  query_text := 'SELECT * FROM items WHERE is_active = true';

  -- Add query condition
  IF query != '' THEN
    query_text := query_text || format(
      ' AND (title ILIKE %L OR description ILIKE %L)',
      '%' || query || '%',
      '%' || query || '%'
    );
  END IF;

  -- Add category filter
  IF filters ? 'category' AND filters->>'category' != '' THEN
    query_text := query_text || format(
      ' AND category_id = (SELECT id FROM categories WHERE slug = %L)',
      filters->>'category'
    );
  END IF;

  -- Add price filters
  IF filters ? 'minPrice' AND filters->>'minPrice' != '' THEN
    query_text := query_text || format(
      ' AND price >= %s',
      filters->>'minPrice'
    );
  END IF;

  IF filters ? 'maxPrice' AND filters->>'maxPrice' != '' THEN
    query_text := query_text || format(
      ' AND price <= %s',
      filters->>'maxPrice'
    );
  END IF;

  -- Add condition filter
  IF filters ? 'condition' AND filters->>'condition' != '' THEN
    query_text := query_text || format(
      ' AND condition = %L',
      filters->>'condition'
    );
  END IF;

  -- Add order and limit
  query_text := query_text || ' ORDER BY created_at DESC LIMIT 50';

  -- Return the query results
  RETURN QUERY EXECUTE query_text;
END;
$$;

-- Create or replace admin_sync_elasticsearch function
CREATE OR REPLACE FUNCTION admin_sync_elasticsearch()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can sync Elasticsearch';
  END IF;

  -- Log action
  INSERT INTO admin_logs (admin_id, action, details)
  VALUES (
    auth.uid(),
    'sync_elasticsearch',
    jsonb_build_object(
      'timestamp', now(),
      'status', 'simulated',
      'info', 'HTTP extension not available'
    )
  );

  RETURN 'Elasticsearch sync simulated (HTTP extension not available)';
END;
$$;