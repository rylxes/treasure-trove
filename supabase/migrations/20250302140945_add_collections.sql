-- File: supabase/migrations/20250302142000_add_collections.sql
/*
  Add support for user collections
*/

-- Create collections table
create table collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  is_public boolean default false,
  created_at timestamptz default now()
);

-- Create collection items table
create table collection_items (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid references collections(id) on delete cascade not null,
  item_id uuid references items(id) on delete cascade not null,
  added_at timestamptz default now(),
  unique(collection_id, item_id)
);

alter table collections enable row level security;
alter table collection_items enable row level security;

-- Policies
create policy "Users can manage their collections"
  on collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public collections are viewable"
  on collections for select
  using (is_public = true);

create policy "Users can manage their collection items"
  on collection_items for all
  using (
    exists (
      select 1 from collections
      where collections.id = collection_items.collection_id
      and collections.user_id = auth.uid()
    )
  );

create policy "Public collection items are viewable"
  on collection_items for select
  using (
    exists (
      select 1 from collections
      where collections.id = collection_items.collection_id
      and collections.is_public = true
    )
  );