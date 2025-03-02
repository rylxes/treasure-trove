-- File: supabase/migrations/20250302143003_rename_parent_id_in_admin_manage_category.sql
/*
  Drop and recreate admin_manage_category to rename parent_id to p_parent_id
  to resolve ambiguity with categories.parent_id column
*/

-- Drop the existing function
drop function if exists admin_manage_category(uuid, text, text, uuid, text);

-- Recreate the function with renamed parameter
create function admin_manage_category(
  category_id uuid,
  category_name text,
  category_slug text,
  p_parent_id uuid default null, -- Renamed from parent_id
  action text default 'create'
)
returns text
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can manage categories';
  end if;

  if action = 'create' then
    insert into categories (name, slug, parent_id)
    values (category_name, category_slug, p_parent_id);
    return 'Category created successfully';
  elsif action = 'update' then
    update categories
    set name = category_name,
        slug = category_slug,
        parent_id = p_parent_id, -- Use renamed parameter
        updated_at = now()
    where id = category_id;
    return 'Category updated successfully';
  elsif action = 'delete' then
    delete from categories where id = category_id;
    return 'Category deleted successfully';
  else
    raise exception 'Invalid action specified';
  end if;

  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'manage_category_' || action,
    jsonb_build_object(
      'category_id', category_id,
      'name', category_name,
      'slug', category_slug,
      'parent_id', p_parent_id -- Log the renamed parameter
    )
  );
end;
$$;