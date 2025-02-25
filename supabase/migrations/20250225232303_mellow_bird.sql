/*
  # Admin Features Enhancement

  1. Changes
    - Add featured and trending flags to items
    - Add user status management
    - Add category management functions for admins
    - Add user management functions for admins

  2. Security
    - Only admins can manage categories
    - Only admins can manage user statuses
    - Only admins can set items as featured/trending
*/

-- Add status to profiles
alter table profiles
add column status text not null default 'active'
check (status in ('active', 'suspended', 'deactivated'));

-- Add featured and trending flags to items
alter table items
add column is_featured boolean not null default false,
add column is_trending boolean not null default false;

-- Function to manage user status
create or replace function manage_user_status(
  target_user_id uuid,
  new_status text,
  reason text default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can manage user status';
  end if;

  -- Update user status
  update profiles
  set status = new_status
  where id = target_user_id;

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'update_user_status',
    jsonb_build_object(
      'user_id', target_user_id,
      'new_status', new_status,
      'reason', reason
    )
  );
end;
$$;

-- Function to reset user password
create or replace function admin_reset_password(
  user_email text,
  new_password text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can reset passwords';
  end if;

  -- Update the password in auth.users
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf'))
  where email = user_email;

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'reset_password',
    jsonb_build_object('user_email', user_email)
  );
end;
$$;

-- Function to manage featured/trending items
create or replace function manage_item_status(
  item_id uuid,
  set_featured boolean default null,
  set_trending boolean default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can manage item status';
  end if;

  -- Update item status
  update items
  set 
    is_featured = coalesce(set_featured, is_featured),
    is_trending = coalesce(set_trending, is_trending)
  where id = item_id;

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'update_item_status',
    jsonb_build_object(
      'item_id', item_id,
      'featured', set_featured,
      'trending', set_trending
    )
  );
end;
$$;

-- Function to create category
create or replace function create_category(
  name text,
  slug text,
  description text default null,
  parent_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_category_id uuid;
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can create categories';
  end if;

  -- Insert new category
  insert into categories (name, slug, description, parent_id)
  values (name, slug, description, parent_id)
  returning id into new_category_id;

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'create_category',
    jsonb_build_object(
      'category_id', new_category_id,
      'name', name,
      'slug', slug
    )
  );

  return new_category_id;
end;
$$;

-- Function to update category
create or replace function update_category(
  category_id uuid,
  new_name text default null,
  new_slug text default null,
  new_description text default null,
  new_parent_id uuid default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can update categories';
  end if;

  -- Update category
  update categories
  set
    name = coalesce(new_name, name),
    slug = coalesce(new_slug, slug),
    description = coalesce(new_description, description),
    parent_id = coalesce(new_parent_id, parent_id)
  where id = category_id;

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'update_category',
    jsonb_build_object(
      'category_id', category_id,
      'name', new_name,
      'slug', new_slug
    )
  );
end;
$$;

-- Function to delete category
create or replace function delete_category(category_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is an admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can delete categories';
  end if;

  -- Check if category has items
  if exists (
    select 1 from items
    where category_id = delete_category.category_id
  ) then
    raise exception 'Cannot delete category with existing items';
  end if;

  -- Delete category
  delete from categories
  where id = category_id;

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'delete_category',
    jsonb_build_object('category_id', category_id)
  );
end;
$$;

-- Update RLS policies for items to allow admin management
create policy "Admins can manage all items"
  on items for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );