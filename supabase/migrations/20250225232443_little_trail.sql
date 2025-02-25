/*
  # Create Secure Auth Users Access Function

  1. Changes
    - Create a secure function for admin access to user emails
    - Function returns only necessary user information
    - Access restricted to admins only

  2. Security
    - Only admins can access the function
    - Emails are only accessible through the function
*/

-- Create function to get auth user emails securely
create or replace function get_auth_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    au.confirmed_at as email_confirmed_at
  from auth.users au
  where exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
$$;