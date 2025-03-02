-- File: supabase/migrations/20250302143004_add_updated_at_to_categories.sql
/*
  Add updated_at column to categories table to fix admin_manage_category error
*/

-- Add the updated_at column
alter table categories
add column if not exists updated_at timestamptz;

-- Optional: Set existing rows to have a default updated_at (e.g., created_at)
update categories
set updated_at = created_at
where updated_at is null;