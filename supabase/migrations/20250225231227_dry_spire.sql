/*
  # Add notifications and analytics features

  1. Changes
    - Add push notification subscription table
    - Add profile views table
    - Add item views table
    - Add functions for tracking views
    - Add realtime notifications

  2. Security
    - Enable RLS on new tables
    - Add policies for view tracking
*/

-- Create push notification subscriptions table
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null,
  auth text not null,
  p256dh text not null,
  created_at timestamptz default now()
);

-- Create profile views table
create table profile_views (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade not null,
  viewer_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Create item views table
create table item_views (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references items(id) on delete cascade not null,
  viewer_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table push_subscriptions enable row level security;
alter table profile_views enable row level security;
alter table item_views enable row level security;

-- RLS Policies

-- Push subscriptions
create policy "Users can manage their push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profile views
create policy "Anyone can create profile views"
  on profile_views for insert
  to authenticated
  with check (true);

create policy "Users can view their profile analytics"
  on profile_views for select
  using (auth.uid() = profile_id);

-- Item views
create policy "Anyone can create item views"
  on item_views for insert
  to authenticated
  with check (true);

create policy "Sellers can view their item analytics"
  on item_views for select
  using (
    exists (
      select 1 from items
      where id = item_views.item_id
      and seller_id = auth.uid()
    )
  );

-- Functions

-- Function to track profile view
create or replace function track_profile_view(viewed_profile_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only track if viewer is different from profile owner
  if auth.uid() != viewed_profile_id then
    insert into profile_views (profile_id, viewer_id)
    values (viewed_profile_id, auth.uid());
  end if;
end;
$$;

-- Function to track item view
create or replace function track_item_view(viewed_item_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into item_views (item_id, viewer_id)
  values (viewed_item_id, auth.uid());
  
  -- Update item view count
  update items
  set views = views + 1
  where id = viewed_item_id;
end;
$$;

-- Function to get unique profile viewers count
create or replace function get_unique_profile_viewers(profile_id uuid)
returns bigint
language sql
security definer
as $$
  select count(distinct viewer_id)
  from profile_views
  where profile_id = $1
  and created_at > now() - interval '30 days';
$$;

-- Function to get unique item viewers count
create or replace function get_unique_item_viewers(item_id uuid)
returns bigint
language sql
security definer
as $$
  select count(distinct viewer_id)
  from item_views
  where item_id = $1
  and created_at > now() - interval '30 days';
$$;

-- Enable realtime for notifications
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;