/*
  # Add seller restrictions

  1. Changes
    - Add validation functions for messages and reviews
    - Add triggers to prevent self-messaging and self-rating
    - Clean up any existing self-messages or self-ratings

  2. Security
    - Ensure data integrity with validation functions
    - Prevent future self-interactions
*/

-- Clean up any existing self-messages
delete from messages
where sender_id = receiver_id;

-- Clean up any existing self-reviews
delete from reviews
where reviewer_id = reviewed_id;

-- Function to validate message creation
create or replace function validate_message()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Prevent self-messaging
  if new.sender_id = new.receiver_id then
    raise exception 'Cannot send message to yourself';
  end if;

  -- Check if trying to message about own item
  if new.item_id is not null and exists (
    select 1 from items
    where id = new.item_id
    and seller_id = new.sender_id
  ) then
    raise exception 'Cannot message about your own item';
  end if;

  return new;
end;
$$;

-- Function to validate review creation
create or replace function validate_review()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Prevent self-review
  if new.reviewer_id = new.reviewed_id then
    raise exception 'Cannot review yourself';
  end if;

  -- Check if trying to review own transaction
  if exists (
    select 1 from transactions
    where id = new.transaction_id
    and (buyer_id = new.reviewer_id and seller_id = new.reviewed_id)
    or (seller_id = new.reviewer_id and buyer_id = new.reviewed_id)
  ) then
    return new;
  else
    raise exception 'Can only review users you have transacted with';
  end if;
end;
$$;

-- Create triggers
create trigger check_message_before_insert
  before insert on messages
  for each row
  execute function validate_message();

create trigger check_review_before_insert
  before insert on reviews
  for each row
  execute function validate_review();