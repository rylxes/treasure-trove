-- File: supabase/migrations/20250302141000_add_saved_searches.sql
/*
  Add support for saved searches and notifications
*/

-- Create saved searches table
create table saved_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  notify_email boolean default false,
  notify_push boolean default false,
  created_at timestamptz default now(),
  last_notified timestamptz
);

alter table saved_searches enable row level security;

-- Policies
create policy "Users can manage their saved searches"
  on saved_searches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Function to check for new matches and notify
create or replace function notify_saved_searches()
returns void
language plpgsql
security definer
as $$
declare
  search record;
  new_items bigint;
begin
  for search in select * from saved_searches where notify_email or notify_push loop
    -- Count new items matching search since last notification
    select count(*)
    into new_items
    from items i
    where i.created_at > coalesce(search.last_notified, 'epoch'::timestamptz)
      and i.is_active = true
      and (
        search.query = '' or
        (i.title ilike '%' || search.query || '%' or i.description ilike '%' || search.query || '%')
      )
      and (
        search.filters->>'category' is null or
        i.category_id = (search.filters->>'category')::uuid
      )
      and (
        search.filters->>'minPrice' is null or
        i.price >= (search.filters->>'minPrice')::numeric
      )
      and (
        search.filters->>'maxPrice' is null or
        i.price <= (search.filters->>'maxPrice')::numeric
      );

    if new_items > 0 then
      -- Update last_notified
      update saved_searches
      set last_notified = now()
      where id = search.id;

      -- Trigger notifications
      if search.notify_email then
        perform net.email_notify(
          search.user_id,
          'New items for your saved search: ' || search.name,
          new_items || ' new items match your search "' || search.name || '"'
        );
      end if;

      if search.notify_push then
        perform send_push_notification(
          search.user_id,
          'New items available',
          new_items || ' new items match your search "' || search.name || '"',
          '/browse?q=' || search.query
        );
      end if;
    end if;
  end loop;
end;
$$;