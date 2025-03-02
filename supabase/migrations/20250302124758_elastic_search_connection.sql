/*
  # Add Elasticsearch connection check function

  1. Changes
    - Create function to check Elasticsearch connection
    - Return connection status and error details
*/

-- Create function to check Elasticsearch connection
create or replace function check_elasticsearch_connection()
returns jsonb
language plpgsql
security definer
as $$
declare
  es_config record;
  http_response record;
  result jsonb;
begin
  -- Get Elasticsearch configuration
  select * into es_config from elasticsearch_config limit 1;

  -- Check if configuration exists
  if not found then
    return jsonb_build_object(
      'available', false,
      'error', 'No Elasticsearch configuration found'
    );
  end if;

  -- Attempt to ping Elasticsearch
  begin
    select
      status,
      content::jsonb as response
    into http_response
    from
      extensions.http(
        (es_config.es_url || '/_cluster/health'),
        'GET',
        ARRAY[('Content-Type', 'application/json')],
        null,
        10 -- short timeout
      );

    -- Check the response
    if http_response.status >= 200 and http_response.status < 300 then
      -- Successfully connected
      result := jsonb_build_object(
        'available', true,
        'status', http_response.status,
        'cluster_name', http_response.response->>'cluster_name',
        'status_color', http_response.response->>'status',
        'number_of_nodes', http_response.response->>'number_of_nodes'
      );
    else
      -- Error response from Elasticsearch
      result := jsonb_build_object(
        'available', false,
        'status', http_response.status,
        'error', case
          when http_response.response->>'error' is not null
          then http_response.response->>'error'
          else 'Unexpected response from Elasticsearch'
        end
      );
    end if;
  exception
    when others then
      -- Connection failed
      result := jsonb_build_object(
        'available', false,
        'error', SQLERRM
      );
  end;

  return result;
end;
$$;

-- Add index existence check function
create or replace function check_elasticsearch_index()
returns jsonb
language plpgsql
security definer
as $$
declare
  es_config record;
  http_response record;
  result jsonb;
begin
  -- Get Elasticsearch configuration
  select * into es_config from elasticsearch_config limit 1;

  -- Check if configuration exists
  if not found then
    return jsonb_build_object(
      'exists', false,
      'error', 'No Elasticsearch configuration found'
    );
  end if;

  -- Attempt to check if index exists
  begin
    select
      status,
      content::jsonb as response
    into http_response
    from
      extensions.http(
        (es_config.es_url || '/' || es_config.items_index),
        'HEAD',
        null,
        null,
        10 -- short timeout
      );

    -- Check the response
    if http_response.status = 200 then
      -- Index exists
      result := jsonb_build_object(
        'exists', true,
        'index', es_config.items_index
      );
    else
      -- Index doesn't exist
      result := jsonb_build_object(
        'exists', false,
        'index', es_config.items_index,
        'status', http_response.status
      );
    end if;
  exception
    when others then
      -- Connection failed
      result := jsonb_build_object(
        'exists', false,
        'index', es_config.items_index,
        'error', SQLERRM
      );
  end;

  return result;
end;
$$;