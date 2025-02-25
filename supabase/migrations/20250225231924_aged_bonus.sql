/*
  # Update message and review validation

  1. Changes
    - Drop existing triggers if they exist
    - Recreate validation functions with improved checks
    - Recreate triggers for message and review validation

  2. Security
    - Prevent self-messaging and messaging about own items
    - Prevent self-reviews
    - Ensure reviews only come from transaction participants
*/

-- Drop existing triggers if they exist
drop trigger if exists check_message_before_insert on messages;
drop trigger if exists check_review_before_insert on reviews;

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