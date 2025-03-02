-- File: supabase/migrations/20250302143000_add_category_management.sql
/*
  Enhance category management for admin
*/

-- Add slug unique constraint if not exists
alter table categories
add constraint categories_slug_unique unique (slug);

-- Function to manage categories
create or replace function admin_manage_category(
  category_id uuid,
  category_name text,
  category_slug text,
  parent_id uuid default null,
  action text default 'create'
)
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
    raise exception 'Only admins can manage categories';
  end if;

  if action = 'create' then
    insert into categories (name, slug, parent_id)
    values (category_name, category_slug, parent_id);
    return 'Category created successfully';
  elsif action = 'update' then
    update categories
    set name = category_name,
        slug = category_slug,
        parent_id = parent_id,
        updated_at = now()
    where id = category_id;
    return 'Category updated successfully';
  elsif action = 'delete' then
    delete from categories where id = category_id;
    return 'Category deleted successfully';
  else
    raise exception 'Invalid action specified';
  end if;

  -- Log action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'manage_category_' || action,
    jsonb_build_object(
      'category_id', category_id,
      'name', category_name,
      'slug', category_slug,
      'parent_id', parent_id
    )
  );
end;
$$;