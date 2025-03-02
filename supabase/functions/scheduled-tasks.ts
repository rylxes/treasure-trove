// supabase/functions/scheduled-tasks.ts
// A Supabase Edge function that will run on a schedule to process notifications

import {createClient} from '@supabase/supabase-js';

// Setup Supabase client (use service role for admin functions)
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Handler for scheduled invoke
export const handler = async () => {
    try {
        // Process price drop notifications
        await supabaseAdmin.rpc('process_price_drop_notifications');
        console.log('Price drop notifications processed');

        // Process back-in-stock notifications
        await supabaseAdmin.rpc('process_stock_notifications');
        console.log('Stock notifications processed');

        // Process saved search alerts
        await supabaseAdmin.rpc('process_saved_search_alerts');
        console.log('Saved search alerts processed');

        return new Response(JSON.stringify({
            success: true,
            message: 'All notification tasks processed successfully'
        }), {
            headers: {'Content-Type': 'application/json'},
            status: 200
        });
    } catch (error) {
        console.error('Error processing notification tasks:', error);

        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: {'Content-Type': 'application/json'},
            status: 500
        });
    }
};

/*
Setup instructions:

1. Create this Edge Function in your Supabase project
2. Set up CRON job to run this function on a schedule (e.g., daily at midnight)
3. Configure environment variables for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

Example CRON schedule (daily at midnight):
0 0 * * *
*/