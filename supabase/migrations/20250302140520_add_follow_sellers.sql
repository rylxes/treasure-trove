-- File: supabase/migrations/20250302140000_add_follow_sellers.sql
/*
  Add support for following sellers
*/

-- Create followers table
create table seller_followers (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid references profiles(id) on delete cascade not null,
  seller_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(follower_id, seller_id)
);

alter table seller_followers enable row level security;

-- Policies
create policy "Users can view their follows"
  on seller_followers for select
  using (auth.uid() = follower_id);

create policy "Users can follow sellers"
  on seller_followers for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow sellers"
  on seller_followers for delete
  using (auth.uid() = follower_id);

-- Function to get followed sellers
create or replace function get_followed_sellers()
returns table (
  id uuid,
  username text,
  rating numeric,
  created_at timestamptz
)
language sql
security definer
as $$
  select
    p.id,
    p.username,
    p.rating,
    sf.created_at
  from seller_followers sf
  join profiles p on p.id = sf.seller_id
  where sf.follower_id = auth.uid()
  order by sf.created_at desc;
$$;