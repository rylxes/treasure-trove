/*
  # Add Admin Functionality

  1. Changes
    - Add admin role to profiles table
    - Create admin logs table and policies
    - Add admin management functions
    - Add RLS policies for admin access

  2. Security
    - Enable RLS for admin_logs table
    - Add policies for admin access
    - Add secure functions for role management
*/

-- Add admin role to profiles
alter table profiles 
add column role text not null default 'user' 
check (role in ('user', 'admin', 'super_admin'));

-- Create admin logs table
create table admin_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id) not null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table admin_logs enable row level security;

-- Admin policies
create policy "Admins can view logs"
  on admin_logs for select
  to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ));

create policy "Admins can create logs"
  on admin_logs for insert
  to authenticated
  with check (
    auth.uid() = admin_id
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Update profile policies for admin management
create policy "Super admin can update admin roles"
  on profiles for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role = 'super_admin'
    )
  );

-- Admin management functions
create or replace function promote_to_admin(user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is a super admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'super_admin'
  ) then
    raise exception 'Only super admin can promote users to admin';
  end if;

  -- Update the user's role to admin
  update profiles
  set role = 'admin'
  where id = user_id
  and role = 'user';

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'promote_to_admin',
    jsonb_build_object('user_id', user_id)
  );
end;
$$;

create or replace function revoke_admin(user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the executing user is a super admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'super_admin'
  ) then
    raise exception 'Only super admin can revoke admin privileges';
  end if;

  -- Cannot revoke super admin
  if exists (
    select 1 from profiles
    where id = user_id
    and role = 'super_admin'
  ) then
    raise exception 'Cannot revoke super admin privileges';
  end if;

  -- Update the user's role to user
  update profiles
  set role = 'user'
  where id = user_id
  and role = 'admin';

  -- Log the action
  insert into admin_logs (admin_id, action, details)
  values (
    auth.uid(),
    'revoke_admin',
    jsonb_build_object('user_id', user_id)
  );
end;
$$;

-- Create function to create the first super admin
create or replace function create_first_super_admin(
  admin_email text,
  admin_password text,
  admin_username text
)
returns void
language plpgsql
security definer
as $$
declare
  new_user_id uuid;
begin
  -- Check if super admin already exists
  if exists (
    select 1 from profiles where role = 'super_admin'
  ) then
    raise exception 'Super admin already exists';
  end if;

  -- Create auth user
  insert into auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data
  ) values (
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    now(),
    jsonb_build_object('username', admin_username, 'full_name', 'Super Admin')
  )
  returning id into new_user_id;

  -- Update the profile to super admin
  update profiles
  set role = 'super_admin',
      username = admin_username,
      full_name = 'Super Admin',
      is_seller = true
  where id = new_user_id;
end;
$$;