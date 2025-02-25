/*
  # Prevent self-offers

  1. Changes
    - Add validation function to prevent sellers from making offers on their own items
    - Create trigger to enforce this validation

  2. Security
    - Prevent sellers from making offers on their own items
    - Clean up any existing self-offers
*/

-- Clean up any existing self-offers
delete from offers
where exists (
  select 1 from items
  where items.id = offers.item_id
  and items.seller_id = offers.buyer_id
);

-- Function to validate offer creation
create or replace function validate_offer()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Check if trying to make an offer on own item
  if exists (
    select 1 from items
    where id = new.item_id
    and seller_id = new.buyer_id
  ) then
    raise exception 'Cannot make an offer on your own item';
  end if;

  return new;
end;
$$;

-- Create trigger
create trigger check_offer_before_insert
  before insert on offers
  for each row
  execute function validate_offer();