/*
  # Add AI Recommendations and Tracking

  1. Changes
    - Create recently_viewed_items table
    - Create recommended_items table
    - Create similar_items table
    - Add functions for tracking and retrieving
*/

-- Create recently viewed items table
create table recently_viewed_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  viewed_at timestamptz default now(),
  view_count int default 1,
  unique(user_id, item_id)
);

-- Create recommended items table
create table recommended_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  score decimal(5,4) not null, -- recommendation score between 0 and 1
  recommendation_type text not null check (recommendation_type in ('similar_items', 'popular', 'personalized')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, item_id, recommendation_type)
);

-- Create similar items table
create table similar_items (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references items(id) on delete cascade not null,
  similar_item_id uuid references items(id) on delete cascade not null,
  similarity_score decimal(5,4) not null, -- similarity score between 0 and 1
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(item_id, similar_item_id)
);

-- Enable RLS
alter table recently_viewed_items enable row level security;
alter table recommended_items enable row level security;
alter table similar_items enable row level security;

-- RLS Policies

-- Recently viewed items
create policy "Users can view their recently viewed items"
  on recently_viewed_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their recently viewed items"
  on recently_viewed_items for insert
  with check (auth.uid() = user_id);

-- Recommended items
create policy "Users can view their recommended items"
  on recommended_items for select
  using (auth.uid() = user_id);

-- Similar items
create policy "Anyone can view similar items"
  on similar_items for select
  using (true);

-- Function to track recently viewed item
create or replace function track_viewed_item(viewed_item_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only track if user is authenticated
  if auth.uid() is null then
    return;
  end if;

  -- Insert or update recently viewed item
  insert into recently_viewed_items (user_id, item_id)
  values (auth.uid(), viewed_item_id)
  on conflict (user_id, item_id) do update
  set viewed_at = now(),
      view_count = recently_viewed_items.view_count + 1;
end;
$$;

-- Function to get recently viewed items
create or replace function get_recently_viewed_items(limit_val int default 10)
returns table (
  id uuid,
  title text,
  price decimal,
  condition text,
  images text[],
  viewed_at timestamptz,
  view_count int
)
language sql
security definer
as $$
  select
    i.id,
    i.title,
    i.price,
    i.condition,
    i.images,
    rv.viewed_at,
    rv.view_count
  from recently_viewed_items rv
  join items i on rv.item_id = i.id
  where rv.user_id = auth.uid()
    and i.is_active = true
  order by rv.viewed_at desc
  limit limit_val;
$$;

-- Function to generate similar items based on category, price, and tags
create or replace function generate_similar_items()
returns void
language plpgsql
security definer
as $$
declare
  item_record record;
begin
  -- Clear existing similar items
  delete from similar_items;

  -- Process each active item
  for item_record in select id, category_id, price, description from items where is_active = true loop
    -- Find similar items based on category and price range
    insert into similar_items (item_id, similar_item_id, similarity_score)
    select
      item_record.id,
      i.id,
      -- Calculate similarity score (higher is better)
      -- Factors: same category (0.5), price similarity (0.3), text similarity in description (0.2)
      0.5 +
      (0.3 * (1.0 - least(abs(i.price - item_record.price) / greatest(item_record.price, 1), 1.0))) +
      (0.2 * (case
        when i.description is not null and item_record.description is not null
        then similarity(i.description, item_record.description)
        else 0
      end))
    from items i
    where i.id != item_record.id
      and i.is_active = true
      and i.category_id = item_record.category_id
      -- Exclude items that are too different in price (> 50% difference)
      and abs(i.price - item_record.price) / greatest(item_record.price, 1) <= 0.5
    order by similarity_score desc
    limit 10;
  end loop;
end;
$$;

-- Function to get similar items
create or replace function get_similar_items(item_id uuid, limit_val int default 8)
returns table (
  id uuid,
  title text,
  price decimal,
  condition text,
  images text[],
  similarity_score decimal
)
language sql
security definer
as $$
  select
    i.id,
    i.title,
    i.price,
    i.condition,
    i.images,
    si.similarity_score
  from similar_items si
  join items i on si.similar_item_id = i.id
  where si.item_id = get_similar_items.item_id
    and i.is_active = true
  order by si.similarity_score desc
  limit limit_val;
$$;

-- Function to generate personalized recommendations
CREATE OR REPLACE FUNCTION generate_personalized_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  viewed_categories jsonb;
  avg_price decimal;
  min_price decimal;
  max_price decimal;
BEGIN
  -- Clear existing personalized recommendations
  DELETE FROM recommended_items WHERE recommendation_type = 'personalized';

  -- Process each user
  FOR user_record IN SELECT id FROM profiles LOOP
    -- Get categories the user has viewed
    SELECT
      jsonb_agg(DISTINCT category_id) AS categories,
      AVG(price) AS avg,
      MIN(price) AS min,
      MAX(price) AS max
    INTO
      viewed_categories, avg_price, min_price, max_price
    FROM items i
    JOIN recently_viewed_items rv ON i.id = rv.item_id
    WHERE rv.user_id = user_record.id;

    -- Skip users with no viewing history
    IF viewed_categories IS NULL THEN
      CONTINUE;
    END IF;

    -- Find items in viewed categories and price range
    INSERT INTO recommended_items (user_id, item_id, score, recommendation_type)
    SELECT
      user_record.id,
      i.id,
      -- Calculate recommendation score
      -- Factors: matching category (0.6), price similarity (0.4)
      0.6 +
      (0.4 * (1.0 - LEAST(
        ABS(i.price - avg_price) /
        GREATEST(max_price - min_price, 1),
        1.0
      )))
    FROM items i
    WHERE i.is_active = TRUE
      -- Only include items in categories the user has viewed
      AND i.category_id IN (SELECT jsonb_array_elements_text(viewed_categories)::uuid)
      -- Exclude items the user has already viewed
      AND NOT EXISTS (
        SELECT 1 FROM recently_viewed_items rv
        WHERE rv.user_id = user_record.id AND rv.item_id = i.id
      )
      -- Exclude items the user is selling
      AND i.seller_id != user_record.id
    ORDER BY RANDOM()
    LIMIT 20
    ON CONFLICT (user_id, item_id, recommendation_type) DO UPDATE
    SET score = EXCLUDED.score,
        updated_at = now();
  END LOOP;
END;
$$;



-- Function to generate popular recommendations
CREATE OR REPLACE FUNCTION generate_popular_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  popular_items RECORD;
BEGIN
  -- Clear existing popular recommendations
  DELETE FROM recommended_items WHERE recommendation_type = 'popular';

  -- Process each user
  FOR user_record IN SELECT id FROM profiles LOOP
    -- Assign popular items to user
    INSERT INTO recommended_items (user_id, item_id, score, recommendation_type)
    SELECT
      user_record.id,
      i.id,
      -- Score based on popularity (views)
      LEAST(i.views::decimal / 100, 1.0) AS score
    FROM items i
    WHERE i.is_active = TRUE
      -- Exclude items the user has already viewed
      AND NOT EXISTS (
        SELECT 1 FROM recently_viewed_items rv
        WHERE rv.user_id = user_record.id AND rv.item_id = i.id
      )
      -- Exclude items the user is selling
      AND i.seller_id != user_record.id
    ORDER BY i.views DESC, i.created_at DESC
    LIMIT 20
    ON CONFLICT (user_id, item_id, recommendation_type) DO UPDATE
    SET score = EXCLUDED.score,
        updated_at = now();
  END LOOP;
END;
$$;

-- Function to get personalized recommendations
create or replace function get_recommended_items(
  recommendation_type text default 'personalized',
  limit_val int default 10
)
returns table (
  id uuid,
  title text,
  price decimal,
  condition text,
  images text[],
  recommendation_score decimal
)
language sql
security definer
as $$
  select
    i.id,
    i.title,
    i.price,
    i.condition,
    i.images,
    r.score as recommendation_score
  from recommended_items r
  join items i on r.item_id = i.id
  where r.user_id = auth.uid()
    and r.recommendation_type = get_recommended_items.recommendation_type
    and i.is_active = true
  order by r.score desc
  limit limit_val;
$$;

-- Create scheduled function to generate recommendations daily
CREATE OR REPLACE FUNCTION daily_recommendation_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update similar items
  PERFORM generate_similar_items();

  -- Update personalized recommendations
  PERFORM generate_personalized_recommendations();

  -- Update popular recommendations
  PERFORM generate_popular_recommendations();
END;
$$;

-- Trigger to update similar items when item is updated
create or replace function update_item_similarity_trigger()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Delete existing similarity records for this item
  delete from similar_items where item_id = NEW.id or similar_item_id = NEW.id;

  -- Find similar items for this specific item
  insert into similar_items (item_id, similar_item_id, similarity_score)
  select
    NEW.id,
    i.id,
    -- Calculate similarity score
    0.5 +
    (0.3 * (1.0 - least(abs(i.price - NEW.price) / greatest(NEW.price, 1), 1.0))) +
    (0.2 * (case
      when i.description is not null and NEW.description is not null
      then similarity(i.description, NEW.description)
      else 0
    end))
  from items i
  where i.id != NEW.id
    and i.is_active = true
    and i.category_id = NEW.category_id
    and abs(i.price - NEW.price) / greatest(NEW.price, 1) <= 0.5
  order by similarity_score desc
  limit 10;

  return NEW;
end;
$$;

-- Create the trigger
drop trigger if exists update_item_similarity on items;
create trigger update_item_similarity
after insert or update of title, description, price, condition, category_id on items
for each row
when (NEW.is_active = true)
execute function update_item_similarity_trigger();

-- Create admin function to manually trigger recommendation updates
create or replace function admin_update_recommendations()
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
    raise exception 'Only admins can update recommendations';
  end if;

  -- Perform update
  perform daily_recommendation_update();

  -- Log action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'update_recommendations',
    jsonb_build_object('timestamp', now())
  );

  return 'Recommendation update initiated successfully';
end;
$$;