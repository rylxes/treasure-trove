/*
  # Create First Super Admin

  1. Changes
    - Creates the first super admin user with:
      - Email: admin@treasuretrove.com
      - Password: admin123
      - Username: superadmin
    
  2. Security
    - Super admin has full access to admin functionality
    - Only one super admin can be created
*/

-- Create the first super admin user
do $$
declare
  new_user_id uuid := '00000000-0000-4000-a000-000000000000';
begin
  -- Check if super admin already exists
  if exists (
    select 1 from auth.users where id = new_user_id
  ) then
    raise exception 'Super admin already exists';
  end if;

  -- Create auth user
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    last_sign_in_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    aud,
    role
  ) values (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@treasuretrove.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    jsonb_build_object('username', 'superadmin', 'full_name', 'Super Admin'),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated'
  );

  -- Create super admin profile if it doesn't exist
  insert into profiles (
    id,
    username,
    full_name,
    role,
    is_seller
  ) values (
    new_user_id,
    'superadmin',
    'Super Admin',
    'super_admin',
    true
  )
  on conflict (id) do update
  set role = 'super_admin',
      username = 'superadmin',
      full_name = 'Super Admin',
      is_seller = true;
end;
$$;