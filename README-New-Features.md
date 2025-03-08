# Hoard Valley New Features Documentation

This document outlines the new features added to the Hoard Valley marketplace application and provides implementation details for each feature.

## Table of Contents

1. [Wish Lists](#wish-lists)
2. [Price Drop Alerts](#price-drop-alerts)
3. [Back-in-Stock Notifications](#back-in-stock-notifications)
4. [Favorite Searches with New Item Alerts](#favorite-searches-with-new-item-alerts)
5. [Scheduled Tasks](#scheduled-tasks)

---

## Wish Lists

### Description
The Wish List feature allows users to save items they're interested in to a dedicated wishlist for easier access in the future.

### Implementation Details

#### Database Tables
- `wish_list_items`: Stores the relationship between users and their saved items
  - `id`: UUID primary key
  - `user_id`: Reference to user profile
  - `item_id`: Reference to saved item
  - `added_at`: Timestamp when item was added to wishlist

#### Components
- `WishListButton`: A reusable button component that toggles an item's presence in the user's wishlist
- `WishlistCount`: Displays the count of items in wishlist with a badge in the navbar
- `Wishlist`: Page component that displays all items in a user's wishlist

#### Functions
- `add_to_wishlist`: Database function to add an item to a user's wishlist
- `remove_from_wishlist`: Database function to remove an item from a user's wishlist
- `is_in_wishlist`: Database function to check if an item is in a user's wishlist
- `get_wishlist_items`: Database function to retrieve a user's wishlist items

### Usage
Users can:
- Add/remove items from their wishlist with a single click
- View their wishlist count in the navigation bar
- Access their full wishlist from the user dropdown menu
- Remove items from the wishlist page

---

## Price Drop Alerts

### Description
Price Drop Alerts allow users to set alerts for items they're interested in and receive notifications when the price drops.

### Implementation Details

#### Database Tables
- `price_history`: Tracks price changes for items
  - `id`: UUID primary key
  - `item_id`: Reference to the item
  - `old_price`: Previous price
  - `new_price`: Updated price
  - `changed_at`: Timestamp of the price change
- `price_alerts`: Stores user price alert preferences
  - `id`: UUID primary key
  - `user_id`: Reference to user profile
  - `item_id`: Reference to the item
  - `target_price`: Optional target price (alert triggers when price drops to or below this value)
  - `notify_email`, `notify_push`: Notification preferences
  - `last_notified_at`: Timestamp of last notification

#### Components
- `PriceAlertButton`: A button component that allows users to set and configure price alerts
- `PriceHistory`: Displays the price history of an item with a chart
- `PriceAlerts`: Page component that displays all of a user's price alerts

#### Functions
- `toggle_price_alert`: Database function to create or remove a price alert
- `has_price_alert`: Database function to check if a user has set a price alert for an item
- `get_price_alerts`: Database function to retrieve a user's price alerts
- `track_price_change`: Trigger function that records price changes
- `process_price_drop_notifications`: Database function that processes and sends price drop notifications

### Usage
Users can:
- Set price alerts with custom target prices
- Choose notification preferences (email, push)
- View price history with a visual chart
- Manage all their price alerts in one place

---

## Back-in-Stock Notifications

### Description
Back-in-Stock Notifications allow users to get alerts when out-of-stock items become available again.

### Implementation Details

#### Database Tables
- `stock_history`: Tracks stock status changes for items
  - `id`: UUID primary key
  - `item_id`: Reference to the item
  - `old_status`: Previous stock status
  - `new_status`: Updated stock status
  - `changed_at`: Timestamp of the status change
- `stock_alerts`: Stores user stock alert preferences
  - `id`: UUID primary key
  - `user_id`: Reference to user profile
  - `item_id`: Reference to the item
  - `notify_email`, `notify_push`: Notification preferences
  - `last_notified_at`: Timestamp of last notification
  
#### Components
- `StockAlertButton`: A button component for setting stock alerts on out-of-stock items
- `StockStatus`: Displays the current stock status of an item
- `UpdateStockStatus`: Interface for sellers to update item stock status
- `StockAlerts`: Page component that displays all of a user's stock alerts

#### Functions
- `toggle_stock_alert`: Database function to create or remove a stock alert
- `has_stock_alert`: Database function to check if a user has set a stock alert for an item
- `get_stock_alerts`: Database function to retrieve a user's stock alerts
- `track_stock_change`: Trigger function that records stock status changes
- `process_stock_notifications`: Database function that processes and sends back-in-stock notifications
- `update_item_stock_status`: Database function for sellers to update item stock status

### Usage
Users can:
- Set alerts for out-of-stock items
- Choose notification preferences (email, push)
- Manage all their stock alerts in one place
- Sellers can update the stock status of their items

---

## Favorite Searches with New Item Alerts

### Description
This feature allows users to save their search queries and filters, and optionally receive alerts when new items matching their criteria are listed.

### Implementation Details

#### Database Tables
- Enhanced `saved_searches` table with new fields:
  - `alert_enabled`: Boolean flag to enable/disable alerts
  - `alert_frequency`: How often to check for new items ('daily', 'weekly', 'instant')
  - `last_alert_sent`: Timestamp of the last alert

#### Components
- `EnhancedSavedSearches`: An improved version of the saved searches component with alert capabilities
- `SavedSearchAlerts`: Page component that displays all saved searches with alert configuration

#### Functions
- `get_saved_search_matches`: Database function to find items that match a saved search
- `process_saved_search_alerts`: Database function that processes and sends alerts for new matching items
- `toggle_saved_search_alert`: Database function to enable/disable alerts and set frequency
- `get_saved_searches_with_alerts`: Database function to retrieve saved searches with alert information

### Usage
Users can:
- Save search criteria with a single click
- Enable alerts for saved searches to be notified of new matching items
- Configure alert frequency (daily, weekly)
- Manage all their saved searches and alerts in one place

---

## Scheduled Tasks

### Description
A Supabase Edge Function that runs on a schedule to process various notifications and alerts.

### Implementation Details

#### Components
- `scheduled-tasks.ts`: A Supabase Edge Function that processes all notification types

#### Setup
1. Create the Edge Function in your Supabase project
2. Set up a CRON job to run the function on a schedule (e.g., daily at midnight)
3. Configure environment variables for Supabase access

#### Features Processed
- Price drop notifications
- Back-in-stock notifications
- Saved search alerts

### Integration Notes
- All notification processing is done server-side to ensure reliability
- The function uses the Supabase service role for administrative access
- Error handling ensures that failures in one notification type don't affect others

---

## Installation Instructions

### Database Migrations
Run the following SQL migrations in order:
1. `wishlist_migration.sql`
2. `price_alerts_migration.sql`
3. `stock_alerts_migration.sql`
4. `search_alerts_migration.sql`

### Frontend Integration
1. Add all new components to your project
2. Update existing components as specified in the implementation
3. Add new routes to App.tsx
4. Update the navigation to include links to new features

### Scheduled Tasks
1. Deploy the edge function to your Supabase project
2. Set up a CRON job to run daily (recommended: midnight)
3. Verify that notifications are being processed correctly

---

## Testing

After implementation, test the following user flows:
1. Add and remove items from wishlist
2. Set price alerts with different target prices
3. Set stock alerts for out-of-stock items
4. Save searches and configure alerts
5. Verify that sellers can update stock status
6. Simulate price drops, stock changes, and new items to test notifications