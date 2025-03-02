# Elasticsearch Setup Guide

This guide provides instructions for setting up Elasticsearch for the Treasure Trove marketplace application.

## Prerequisites

- Docker installed on your development or production server
- Supabase project with the migration scripts already applied
- Admin access to both Supabase and the server where Elasticsearch will run

## Step 1: Deploy Elasticsearch with Docker

You can run Elasticsearch in a Docker container:

```bash
# Create a directory for Elasticsearch data
mkdir -p ~/elasticsearch/data

# Set correct permissions
chmod 777 ~/elasticsearch/data

# Run Elasticsearch container
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -v ~/elasticsearch/data:/usr/share/elasticsearch/data \
  elasticsearch:8.12.0
```

## Step 2: Enable the HTTP Extension in Supabase

The Elasticsearch integration requires the HTTP extension in Supabase to make external API calls. You need to enable this in your Supabase project:

1. Go to your Supabase dashboard
2. Open the SQL Editor
3. Run the following SQL to enable the HTTP extension:

```sql
-- Enable the HTTP extension if not already enabled
create extension if not exists "http" with schema extensions;
```

## Step 3: Configure Elasticsearch Connection

Update the Elasticsearch configuration in your Supabase database:

```sql
-- Update Elasticsearch configuration with your actual Elasticsearch URL
update elasticsearch_config
set es_url = 'http://your-elasticsearch-host:9200'
where id = 1;
```

Replace `your-elasticsearch-host` with the actual hostname or IP address where Elasticsearch is running.

## Step 4: Initial Data Sync

Use the admin panel in your application to trigger the initial sync of data to Elasticsearch:

1. Log in as an admin user
2. Navigate to Admin Dashboard
3. Select the "Admin Tools" tab
4. Click on "Sync Elasticsearch"

Alternatively, you can run the sync function directly from the Supabase SQL Editor:

```sql
-- Trigger initial Elasticsearch sync
select admin_sync_elasticsearch();
```

## Step 5: Configure Scheduled Updates (Optional)

For production environments, you may want to set up a scheduled job to periodically sync all data:

### Using Supabase Edge Functions (Recommended)

1. Create a new Edge Function in Supabase
2. Set up a scheduled CRON job to run this function daily
3. In your function, make an authenticated API call to trigger the sync

Example Edge Function:

```typescript
import { createClient } from '@supabase/supabase-js'

// Setup Supabase client (use service role for admin functions)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Handler for scheduled invoke
export const handler = async () => {
  try {
    const { data, error } = await supabaseAdmin.rpc('admin_sync_elasticsearch')
    
    if (error) throw error
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Elasticsearch sync completed successfully'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
}
```

Then schedule this function to run daily using the Supabase dashboard.

## Step 6: Testing the Integration

1. Create or update some items in your marketplace
2. Verify logs to ensure the items are being indexed in Elasticsearch
3. Test the search functionality to confirm results are appearing correctly

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure Elasticsearch is running and accessible from your Supabase instance
2. **CORS Errors**: Check your Elasticsearch configuration to allow requests from your Supabase instance
3. **Missing Data**: If items don't appear in search results, check:
   - Elasticsearch logs for indexing errors
   - Supabase logs for sync function errors
   - Item's `is_active` flag (only active items are indexed)

### Debugging Tools

- Use the Elasticsearch REST API to manually check indexes: `GET http://localhost:9200/treasure_trove_items/_search`
- Check Supabase logs for any errors in the sync functions
- Use the Admin dashboard to manually trigger syncs and check for errors