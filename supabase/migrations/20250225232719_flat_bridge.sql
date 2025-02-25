/*
  # Add Escrow System

  1. New Tables
    - `escrow_transactions`
      - Tracks escrow payments and status
    - `escrow_disputes`
      - Handles dispute cases
    - `transaction_logs`
      - Audit trail for all transaction events

  2. Changes
    - Add escrow status to transactions table
    - Add dispute handling capabilities
    - Add admin escrow management functions

  3. Security
    - Enable RLS on all new tables
    - Add policies for buyers, sellers, and admins
*/

-- Add escrow status to transactions
alter table transactions
add column escrow_status text not null default 'pending'
check (escrow_status in ('pending', 'funded', 'released', 'refunded', 'disputed'));

-- Create escrow transactions table
create table escrow_transactions (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) not null,
  amount decimal(10,2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'funded', 'released', 'refunded')),
  funded_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create escrow disputes table
create table escrow_disputes (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) not null,
  reported_by uuid references profiles(id) not null,
  reason text not null,
  evidence jsonb,
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'closed')),
  resolution text,
  resolved_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create transaction logs table
create table transaction_logs (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) not null,
  action text not null,
  details jsonb,
  performed_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table escrow_transactions enable row level security;
alter table escrow_disputes enable row level security;
alter table transaction_logs enable row level security;

-- RLS Policies

-- Escrow transactions
create policy "Users can view their escrow transactions"
  on escrow_transactions for select
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

create policy "Admins can manage escrow transactions"
  on escrow_transactions for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Escrow disputes
create policy "Users can view their disputes"
  on escrow_disputes for select
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

create policy "Users can create disputes"
  on escrow_disputes for insert
  with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
    and reported_by = auth.uid()
  );

create policy "Admins can manage disputes"
  on escrow_disputes for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Transaction logs
create policy "Users can view their transaction logs"
  on transaction_logs for select
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
    )
  );

create policy "Admins can view all transaction logs"
  on transaction_logs for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Functions

-- Function to create escrow transaction
create or replace function create_escrow_transaction(
  item_id uuid,
  amount decimal
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_transaction_id uuid;
  new_escrow_id uuid;
begin
  -- Create the transaction
  insert into transactions (
    item_id,
    buyer_id,
    seller_id,
    amount,
    status,
    escrow_status
  )
  select
    item_id,
    auth.uid(),
    seller_id,
    amount,
    'pending',
    'pending'
  from items
  where id = item_id
  returning id into new_transaction_id;

  -- Create the escrow transaction
  insert into escrow_transactions (
    transaction_id,
    amount,
    status
  )
  values (
    new_transaction_id,
    amount,
    'pending'
  )
  returning id into new_escrow_id;

  -- Log the action
  insert into transaction_logs (
    transaction_id,
    action,
    details,
    performed_by
  )
  values (
    new_transaction_id,
    'create_escrow',
    jsonb_build_object(
      'amount', amount,
      'escrow_id', new_escrow_id
    ),
    auth.uid()
  );

  return new_transaction_id;
end;
$$;

-- Function to fund escrow
create or replace function fund_escrow(transaction_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Verify user is the buyer
  if not exists (
    select 1 from transactions
    where id = transaction_id
    and buyer_id = auth.uid()
    and escrow_status = 'pending'
  ) then
    raise exception 'Unauthorized or invalid transaction status';
  end if;

  -- Update transaction and escrow status
  update transactions
  set escrow_status = 'funded'
  where id = transaction_id;

  update escrow_transactions
  set 
    status = 'funded',
    funded_at = now()
  where transaction_id = fund_escrow.transaction_id;

  -- Log the action
  insert into transaction_logs (
    transaction_id,
    action,
    details,
    performed_by
  )
  values (
    transaction_id,
    'fund_escrow',
    jsonb_build_object('funded_at', now()),
    auth.uid()
  );
end;
$$;

-- Function to release escrow
create or replace function release_escrow(transaction_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Verify user is admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can release escrow';
  end if;

  -- Verify transaction status
  if not exists (
    select 1 from transactions
    where id = transaction_id
    and escrow_status = 'funded'
  ) then
    raise exception 'Invalid transaction status';
  end if;

  -- Update transaction and escrow status
  update transactions
  set 
    escrow_status = 'released',
    status = 'completed'
  where id = transaction_id;

  update escrow_transactions
  set 
    status = 'released',
    released_at = now()
  where transaction_id = release_escrow.transaction_id;

  -- Log the action
  insert into transaction_logs (
    transaction_id,
    action,
    details,
    performed_by
  )
  values (
    transaction_id,
    'release_escrow',
    jsonb_build_object('released_at', now()),
    auth.uid()
  );
end;
$$;

-- Function to refund escrow
create or replace function refund_escrow(transaction_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Verify user is admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can refund escrow';
  end if;

  -- Verify transaction status
  if not exists (
    select 1 from transactions
    where id = transaction_id
    and escrow_status in ('funded', 'disputed')
  ) then
    raise exception 'Invalid transaction status';
  end if;

  -- Update transaction and escrow status
  update transactions
  set 
    escrow_status = 'refunded',
    status = 'cancelled'
  where id = transaction_id;

  update escrow_transactions
  set 
    status = 'refunded',
    refunded_at = now()
  where transaction_id = refund_escrow.transaction_id;

  -- Log the action
  insert into transaction_logs (
    transaction_id,
    action,
    details,
    performed_by
  )
  values (
    transaction_id,
    'refund_escrow',
    jsonb_build_object('refunded_at', now()),
    auth.uid()
  );
end;
$$;

-- Function to create dispute
create or replace function create_dispute(
  transaction_id uuid,
  reason text,
  evidence jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  new_dispute_id uuid;
begin
  -- Verify user is buyer or seller
  if not exists (
    select 1 from transactions
    where id = transaction_id
    and (buyer_id = auth.uid() or seller_id = auth.uid())
    and escrow_status = 'funded'
  ) then
    raise exception 'Unauthorized or invalid transaction status';
  end if;

  -- Create dispute
  insert into escrow_disputes (
    transaction_id,
    reported_by,
    reason,
    evidence
  )
  values (
    transaction_id,
    auth.uid(),
    reason,
    evidence
  )
  returning id into new_dispute_id;

  -- Update transaction status
  update transactions
  set escrow_status = 'disputed'
  where id = transaction_id;

  -- Log the action
  insert into transaction_logs (
    transaction_id,
    action,
    details,
    performed_by
  )
  values (
    transaction_id,
    'create_dispute',
    jsonb_build_object(
      'dispute_id', new_dispute_id,
      'reason', reason
    ),
    auth.uid()
  );

  return new_dispute_id;
end;
$$;

-- Function to resolve dispute
create or replace function resolve_dispute(
  dispute_id uuid,
  resolution text,
  action text
)
returns void
language plpgsql
security definer
as $$
declare
  transaction_id uuid;
begin
  -- Verify user is admin
  if not exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  ) then
    raise exception 'Only admins can resolve disputes';
  end if;

  -- Get transaction ID
  select d.transaction_id into transaction_id
  from escrow_disputes d
  where d.id = dispute_id;

  -- Update dispute
  update escrow_disputes
  set 
    status = 'resolved',
    resolution = resolve_dispute.resolution,
    resolved_by = auth.uid(),
    updated_at = now()
  where id = dispute_id;

  -- Handle resolution action
  case action
    when 'release' then
      perform release_escrow(transaction_id);
    when 'refund' then
      perform refund_escrow(transaction_id);
    else
      raise exception 'Invalid resolution action';
  end case;

  -- Log the action
  insert into transaction_logs (
    transaction_id,
    action,
    details,
    performed_by
  )
  values (
    transaction_id,
    'resolve_dispute',
    jsonb_build_object(
      'dispute_id', dispute_id,
      'resolution', resolution,
      'action', action
    ),
    auth.uid()
  );
end;
$$;