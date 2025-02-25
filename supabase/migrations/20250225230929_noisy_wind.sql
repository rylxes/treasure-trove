/*
  # Create secure function to access auth user emails

  1. Changes
    - Creates a secure function to access auth.users emails
    - Function is only accessible to admins
*/

-- Create function to get auth user emails
create or replace function get_auth_user_emails(user_ids uuid[])
returns table (id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select id, email
  from auth.users
  where id = any(user_ids)
  and exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
$$;