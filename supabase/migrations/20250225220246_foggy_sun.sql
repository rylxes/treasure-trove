/*
  # Initial Schema for Treasure Trove

  1. Tables
    - profiles
      - User profiles with ratings and metadata
    - items
      - Product listings with details and images
    - categories
      - Product categories
    - transactions
      - Transaction records
    - reviews
      - User reviews and ratings
    - messages
      - Chat messages between users
    - offers
      - Purchase offers and negotiations
    - notifications
      - System notifications

  2. Security
    - RLS policies for all tables
    - Authentication using Supabase Auth

  3. Enums
    - item_condition
    - selling_method
    - transaction_status
    - offer_status
*/

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums
create type item_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
create type selling_method as enum ('fixed', 'negotiation', 'auction');
create type transaction_status as enum ('pending', 'processing', 'completed', 'disputed', 'cancelled');
create type offer_status as enum ('pending', 'accepted', 'rejected', 'expired', 'countered');

-- Profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  rating decimal(3,2) default 0,
  total_ratings int default 0,
  is_seller boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Categories table
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  description text,
  parent_id uuid references categories(id),
  created_at timestamptz default now()
);

-- Items table
create table items (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  condition item_condition not null,
  price decimal(10,2),
  selling_method selling_method not null,
  category_id uuid references categories(id) not null,
  images text[] not null default '{}',
  location text,
  is_active boolean default true,
  views int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ends_at timestamptz -- for auctions
);

-- Transactions table
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references items(id) not null,
  buyer_id uuid references profiles(id) not null,
  seller_id uuid references profiles(id) not null,
  amount decimal(10,2) not null,
  status transaction_status not null default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reviews table
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) not null,
  reviewer_id uuid references profiles(id) not null,
  reviewed_id uuid references profiles(id) not null,
  rating int check (rating >= 1 and rating <= 5) not null,
  comment text,
  created_at timestamptz default now()
);

-- Messages table
create table messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references profiles(id) not null,
  receiver_id uuid references profiles(id) not null,
  item_id uuid references items(id),
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- Offers table
create table offers (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid references items(id) not null,
  buyer_id uuid references profiles(id) not null,
  amount decimal(10,2) not null,
  status offer_status not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notifications table
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) not null,
  title text not null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table items enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table reviews enable row level security;
alter table messages enable row level security;
alter table offers enable row level security;
alter table notifications enable row level security;

-- RLS Policies

-- Profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Items
create policy "Anyone can view active items"
  on items for select
  using (is_active = true);

create policy "Sellers can manage their items"
  on items for all
  using (auth.uid() = seller_id);

-- Categories
create policy "Categories are viewable by everyone"
  on categories for select
  using (true);

-- Transactions
create policy "Users can view their transactions"
  on transactions for select
  using (auth.uid() in (buyer_id, seller_id));

create policy "Buyers can create transactions"
  on transactions for insert
  with check (auth.uid() = buyer_id);

-- Reviews
create policy "Reviews are viewable by everyone"
  on reviews for select
  using (true);

create policy "Users can create reviews for their transactions"
  on reviews for insert
  with check (
    exists (
      select 1 from transactions
      where id = transaction_id
      and (buyer_id = auth.uid() or seller_id = auth.uid())
    )
  );

-- Messages
create policy "Users can view their messages"
  on messages for select
  using (auth.uid() in (sender_id, receiver_id));

create policy "Users can send messages"
  on messages for insert
  with check (auth.uid() = sender_id);

-- Offers
create policy "Users can view their offers"
  on offers for select
  using (
    auth.uid() = buyer_id or
    exists (
      select 1 from items
      where id = item_id and seller_id = auth.uid()
    )
  );

create policy "Buyers can create offers"
  on offers for insert
  with check (auth.uid() = buyer_id);

-- Notifications
create policy "Users can view their notifications"
  on notifications for select
  using (auth.uid() = user_id);

-- Functions and Triggers

-- Function to update user rating
create or replace function update_user_rating()
returns trigger as $$
begin
  update profiles
  set
    rating = (
      select avg(rating)::decimal(3,2)
      from reviews
      where reviewed_id = new.reviewed_id
    ),
    total_ratings = (
      select count(*)
      from reviews
      where reviewed_id = new.reviewed_id
    )
  where id = new.reviewed_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for updating user rating
create trigger on_review_created
  after insert on reviews
  for each row
  execute function update_user_rating();

-- Function to create notification
create or replace function create_notification(
  user_id uuid,
  title text,
  content text
) returns void as $$
begin
  insert into notifications (user_id, title, content)
  values (user_id, title, content);
end;
$$ language plpgsql security definer;