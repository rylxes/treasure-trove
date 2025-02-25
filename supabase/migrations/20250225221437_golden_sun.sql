/*
  # Create get_conversations function

  1. Function
    - Creates a stored procedure to get user conversations
    - Returns conversations with last message and unread count
    - Orders by last message time
*/

create or replace function get_conversations(user_id uuid)
returns table (
  user_id uuid,
  username text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint
) language sql security definer as $$
  with conversations as (
    select distinct
      case
        when sender_id = get_conversations.user_id then receiver_id
        else sender_id
      end as other_user_id,
      first_value(content) over w as last_message,
      first_value(created_at) over w as last_message_time,
      count(*) filter (where receiver_id = get_conversations.user_id and read = false) over (partition by
        case
          when sender_id = get_conversations.user_id then receiver_id
          else sender_id
        end
      ) as unread_count
    from messages
    where sender_id = get_conversations.user_id or receiver_id = get_conversations.user_id
    window w as (
      partition by
        case
          when sender_id = get_conversations.user_id then receiver_id
          else sender_id
        end
      order by created_at desc
    )
  )
  select distinct
    c.other_user_id as user_id,
    p.username,
    c.last_message,
    c.last_message_time,
    c.unread_count
  from conversations c
  join profiles p on p.id = c.other_user_id
  order by c.last_message_time desc;
$$;