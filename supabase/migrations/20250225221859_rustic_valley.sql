/*
  # Create auth profile trigger

  1. Function
    - Creates a function to automatically create a profile when a user signs up
    - Sets default values for required fields
  
  2. Trigger
    - Adds trigger to create profile on user creation
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

-- Enable realtime for profiles
alter publication supabase_realtime add table profiles;

-- Set up auth trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();