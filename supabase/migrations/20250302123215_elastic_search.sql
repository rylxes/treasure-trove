/*
  # Add Elasticsearch integration

  1. Changes
    - Create function to sync data to Elasticsearch
    - Create triggers to automatically sync data on changes
    - Add search functions using Elasticsearch
*/

-- Create extension if needed
create extension if not exists "http" with schema extensions;

-- Create Elasticsearch configuration table
create table elasticsearch_config (
  id serial primary key,
  es_url text not null,
  api_key text,
  items_index text not null,
  last_sync timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default configuration
insert into elasticsearch_config (es_url, api_key, items_index)
values ('http://localhost:9200', null, 'treasure_trove_items');

-- Create function to sync items to Elasticsearch
create or replace function sync_item_to_elasticsearch(item_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  item_json jsonb;
  es_config record;
  http_response record;
begin
  -- Get Elasticsearch configuration
  select * into es_config from elasticsearch_config limit 1;

  -- Get item data with related information
  select
    jsonb_build_object(
      'id', i.id,
      'title', i.title,
      'description', i.description,
      'price', i.price,
      'condition', i.condition,
      'images', i.images,
      'category', jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug
      ),
      'seller', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'rating', p.rating
      ),
      'location', i.location,
      'is_active', i.is_active,
      'created_at', i.created_at
    ) into item_json
  from items i
  join categories c on i.category_id = c.id
  join profiles p on i.seller_id = p.id
  where i.id = item_id;

  -- Send to Elasticsearch
  select
    status,
    content::text
  into http_response
  from
    extensions.http(
      (es_config.es_url || '/' || es_config.items_index || '/_doc/' || item_id),
      'PUT',
      ARRAY[
        ('Content-Type', 'application/json')
      ],
      item_json::text,
      60
    );

  -- Update last sync time
  update elasticsearch_config set last_sync = now(), updated_at = now();

  -- Log result
  raise notice 'Elasticsearch sync result: % %', http_response.status, http_response.content;
end;
$$;

-- Create function to delete item from Elasticsearch
create or replace function delete_item_from_elasticsearch(item_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  es_config record;
  http_response record;
begin
  -- Get Elasticsearch configuration
  select * into es_config from elasticsearch_config limit 1;

  -- Delete from Elasticsearch
  select
    status,
    content::text
  into http_response
  from
    extensions.http(
      (es_config.es_url || '/' || es_config.items_index || '/_doc/' || item_id),
      'DELETE',
      null,
      null,
      60
    );

  -- Update last sync time
  update elasticsearch_config set last_sync = now(), updated_at = now();

  -- Log result
  raise notice 'Elasticsearch delete result: % %', http_response.status, http_response.content;
end;
$$;

-- Create function to sync all items to Elasticsearch
create or replace function sync_all_items_to_elasticsearch()
returns void
language plpgsql
security definer
as $$
declare
  item_record record;
begin
  -- First, create the index if it doesn't exist
  declare
    es_config record;
    http_response record;
    index_settings jsonb := '{
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
          "analyzer": {
            "english_analyzer": {
              "tokenizer": "standard",
              "filter": ["lowercase", "english_stemmer", "english_stop"]
            }
          },
          "filter": {
            "english_stemmer": {
              "type": "stemmer",
              "language": "english"
            },
            "english_stop": {
              "type": "stop",
              "stopwords": "_english_"
            }
          }
        }
      },
      "mappings": {
        "properties": {
          "title": {
            "type": "text",
            "analyzer": "english_analyzer",
            "fields": {
              "keyword": {
                "type": "keyword"
              }
            }
          },
          "description": {
            "type": "text",
            "analyzer": "english_analyzer"
          },
          "price": {
            "type": "float"
          },
          "condition": {
            "type": "keyword"
          },
          "category": {
            "properties": {
              "id": { "type": "keyword" },
              "name": { "type": "text" },
              "slug": { "type": "keyword" }
            }
          },
          "location": {
            "type": "text",
            "fields": {
              "keyword": {
                "type": "keyword"
              }
            }
          },
          "is_active": {
            "type": "boolean"
          },
          "created_at": {
            "type": "date"
          }
        }
      }
    }';
  begin
    -- Get Elasticsearch configuration
    select * into es_config from elasticsearch_config limit 1;

    -- Create index with settings
    select
      status,
      content::text
    into http_response
    from
      extensions.http(
        (es_config.es_url || '/' || es_config.items_index),
        'PUT',
        ARRAY[('Content-Type', 'application/json')],
        index_settings::text,
        60
      );

    -- Log result
    raise notice 'Elasticsearch index creation: % %', http_response.status, http_response.content;
  end;

  -- Sync each active item
  for item_record in select id from items where is_active = true loop
    perform sync_item_to_elasticsearch(item_record.id);
  end loop;
end;
$$;

-- Create function to search items with Elasticsearch
create or replace function search_items_elasticsearch(
  search_query text,
  category_slug text default null,
  min_price decimal default null,
  max_price decimal default null,
  condition_filter text default null,
  sort_by text default 'newest',
  limit_val int default 20,
  offset_val int default 0
)
returns jsonb
language plpgsql
security definer
as $$
declare
  es_config record;
  search_json jsonb;
  http_response record;
begin
  -- Get Elasticsearch configuration
  select * into es_config from elasticsearch_config limit 1;

  -- Build search query
  search_json := jsonb_build_object(
    'size', limit_val,
    'from', offset_val,
    'query', jsonb_build_object(
      'bool', jsonb_build_object(
        'must', case
          when search_query is null or search_query = '' then jsonb_build_object('match_all', jsonb_build_object())
          else jsonb_build_object(
            'multi_match', jsonb_build_object(
              'query', search_query,
              'fields', jsonb_build_array('title^3', 'description', 'category.name'),
              'fuzziness', 'AUTO'
            )
          )
        end,
        'filter', jsonb_build_array(
          jsonb_build_object('term', jsonb_build_object('is_active', true))
        )
      )
    )
  );

  -- Add category filter if provided
  if category_slug is not null then
    search_json := jsonb_set(
      search_json,
      '{query,bool,filter}',
      (search_json -> 'query' -> 'bool' -> 'filter') ||
      jsonb_build_object('term', jsonb_build_object('category.slug', category_slug))
    );
  end if;

  -- Add price range filter if provided
  if min_price is not null or max_price is not null then
    declare
      range_obj jsonb := jsonb_build_object('range', jsonb_build_object('price', jsonb_build_object()));
    begin
      if min_price is not null then
        range_obj := jsonb_set(range_obj, '{range,price,gte}', to_jsonb(min_price));
      end if;

      if max_price is not null then
        range_obj := jsonb_set(range_obj, '{range,price,lte}', to_jsonb(max_price));
      end if;

      search_json := jsonb_set(
        search_json,
        '{query,bool,filter}',
        (search_json -> 'query' -> 'bool' -> 'filter') || range_obj
      );
    end;
  end if;

  -- Add condition filter if provided
  if condition_filter is not null then
    search_json := jsonb_set(
      search_json,
      '{query,bool,filter}',
      (search_json -> 'query' -> 'bool' -> 'filter') ||
      jsonb_build_object('term', jsonb_build_object('condition', condition_filter))
    );
  end if;

  -- Add sorting
  case sort_by
    when 'price-asc' then
      search_json := jsonb_set(
        search_json,
        '{sort}',
        jsonb_build_array(
          jsonb_build_object('price', jsonb_build_object('order', 'asc'))
        )
      );
    when 'price-desc' then
      search_json := jsonb_set(
        search_json,
        '{sort}',
        jsonb_build_array(
          jsonb_build_object('price', jsonb_build_object('order', 'desc'))
        )
      );
    else -- 'newest' is default
      search_json := jsonb_set(
        search_json,
        '{sort}',
        jsonb_build_array(
          jsonb_build_object('created_at', jsonb_build_object('order', 'desc'))
        )
      );
  end case;

  -- Execute search query
  select
    status,
    content::jsonb
  into http_response
  from
    extensions.http(
      (es_config.es_url || '/' || es_config.items_index || '/_search'),
      'POST',
      ARRAY[('Content-Type', 'application/json')],
      search_json::text,
      60
    );

  -- Return search results
  return http_response.content;
end;
$$;

-- Create triggers to sync items to Elasticsearch
create or replace function item_elasticsearch_trigger_func()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    if NEW.is_active then
      perform sync_item_to_elasticsearch(NEW.id);
    else
      perform delete_item_from_elasticsearch(NEW.id);
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    perform delete_item_from_elasticsearch(OLD.id);
    return OLD;
  end if;
  return NULL;
end;
$$;

-- Create the trigger
drop trigger if exists item_elasticsearch_trigger on items;
create trigger item_elasticsearch_trigger
after insert or update or delete on items
for each row
execute function item_elasticsearch_trigger_func();

-- Create an admin function to manually sync items
create or replace function admin_sync_elasticsearch()
returns text
language plpgsql
security definer
as $$
begin
  -- Check if user is admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can sync Elasticsearch';
  end if;

  -- Perform sync
  perform sync_all_items_to_elasticsearch();

  -- Log action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'sync_elasticsearch',
    jsonb_build_object('timestamp', now())
  );

  return 'Elasticsearch sync initiated successfully';
end;
$$;