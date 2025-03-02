// src/lib/elasticsearch.ts
import { supabase } from './supabase';

// Interface for search parameters
export interface SearchParams {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  sort?: 'newest' | 'price-asc' | 'price-desc';
  limit?: number;
  offset?: number;
}

// Interface for search response
export interface SearchResponse {
  items: SearchItem[];
  total: number;
  took: number; // milliseconds the search took
  searchMode: 'elasticsearch' | 'database'; // indicates which search method was used
}

// Interface for search item
export interface SearchItem {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
  seller: {
    id: string;
    username: string;
    rating: number;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  created_at: string;
}

// Elasticsearch status information
export interface ElasticsearchStatus {
  available: boolean;
  configured: boolean;
  url?: string;
  index?: string;
  lastSync?: string;
  error?: string;
}

// Cache the status to avoid repeated checks
let cachedStatus: ElasticsearchStatus | null = null;
const cacheExpiry = 60000; // 1 minute
let lastStatusCheck = 0;

/**
 * Check if Elasticsearch is configured and available
 */
export async function checkElasticsearchStatus(): Promise<ElasticsearchStatus> {
  // Return cached status if recent
  if (cachedStatus && Date.now() - lastStatusCheck < cacheExpiry) {
    return cachedStatus;
  }

  try {
    // Get Elasticsearch configuration
    const { data: config, error: configError } = await supabase
      .from('elasticsearch_config')
      .select('es_url, items_index, last_sync')
      .limit(1)
      .single();

    if (configError) {
      cachedStatus = {
        available: false,
        configured: false,
        error: 'Configuration not found'
      };
      lastStatusCheck = Date.now();
      return cachedStatus;
    }

    // Check if configuration is complete
    if (!config.es_url || !config.items_index) {
      cachedStatus = {
        available: false,
        configured: false,
        url: config.es_url,
        index: config.items_index,
        error: 'Incomplete configuration'
      };
      lastStatusCheck = Date.now();
      return cachedStatus;
    }

    // Ping Elasticsearch to check availability
    const { data: pingData, error: pingError } = await supabase.rpc('check_elasticsearch_connection');

    if (pingError || !pingData || !pingData.available) {
      cachedStatus = {
        available: false,
        configured: true,
        url: config.es_url,
        index: config.items_index,
        lastSync: config.last_sync,
        error: pingError?.message || pingData?.error || 'Connection test failed'
      };
      lastStatusCheck = Date.now();
      return cachedStatus;
    }

    // Elasticsearch is available
    cachedStatus = {
      available: true,
      configured: true,
      url: config.es_url,
      index: config.items_index,
      lastSync: config.last_sync
    };
    lastStatusCheck = Date.now();
    return cachedStatus;
  } catch (error) {
    console.error('Error checking Elasticsearch status:', error);
    cachedStatus = {
      available: false,
      configured: false,
      error: error instanceof Error ? error.message : String(error)
    };
    lastStatusCheck = Date.now();
    return cachedStatus;
  }
}

/**
 * Search for items using either Elasticsearch or database
 * Will automatically choose the best method based on availability
 */
export async function searchItems(params: SearchParams): Promise<SearchResponse> {
  // Check Elasticsearch status
  const status = await checkElasticsearchStatus();

  // If Elasticsearch is available, use it
  if (status.available) {
    try {
      const response = await searchWithElasticsearch(params);
      return {
        ...response,
        searchMode: 'elasticsearch'
      };
    } catch (error) {
      console.error('Elasticsearch search failed, falling back to database:', error);
      const dbResponse = await searchWithDatabase(params);
      return {
        ...dbResponse,
        searchMode: 'database'
      };
    }
  } else {
    // Use database search
    const response = await searchWithDatabase(params);
    return {
      ...response,
      searchMode: 'database'
    };
  }
}

/**
 * Force search using Elasticsearch (will fail if not available)
 */
export async function searchWithElasticsearch(params: SearchParams): Promise<SearchResponse> {
  const { query, category, minPrice, maxPrice, condition, sort = 'newest', limit = 20, offset = 0 } = params;

  // Call the Supabase function that interfaces with Elasticsearch
  const { data, error } = await supabase.rpc('search_items_elasticsearch', {
    search_query: query,
    category_slug: category,
    min_price: minPrice,
    max_price: maxPrice,
    condition_filter: condition,
    sort_by: sort,
    limit_val: limit,
    offset_val: offset
  });

  if (error) throw error;

  // Transform Elasticsearch response to our format
  const hits = data.hits.hits;
  const items = hits.map((hit: any) => ({
    id: hit._id,
    ...hit._source
  }));

  return {
    items,
    total: data.hits.total.value,
    took: data.took,
    searchMode: 'elasticsearch'
  };
}

/**
 * Search using the database (optimized fallback)
 */
export async function searchWithDatabase(params: SearchParams): Promise<SearchResponse> {
  const startTime = Date.now();
  try {
    const { query, category, minPrice, maxPrice, condition, sort = 'newest', limit = 20, offset = 0 } = params;

    // Start building query
    let queryBuilder = supabase
      .from('items')
      .select(`
        id,
        title,
        price,
        condition,
        images,
        created_at,
        seller:seller_id (
          id,
          username,
          rating
        ),
        category:category_id (
          id,
          name,
          slug
        )
      `, { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (query && query.trim() !== '') {
      // Optimize search by using ts_search if available or fallback to ILIKE
      queryBuilder = queryBuilder.or(
        `title.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    if (category) {
      // Join with categories for slug matching
      queryBuilder = queryBuilder.eq('category.slug', category);
    }

    if (minPrice !== undefined && minPrice !== null) {
      queryBuilder = queryBuilder.gte('price', minPrice);
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      queryBuilder = queryBuilder.lte('price', maxPrice);
    }

    if (condition) {
      queryBuilder = queryBuilder.eq('condition', condition);
    }

    // Apply sorting
    switch (sort) {
      case 'price-asc':
        queryBuilder = queryBuilder.order('price', { ascending: true });
        break;
      case 'price-desc':
        queryBuilder = queryBuilder.order('price', { ascending: false });
        break;
      default: // 'newest'
        queryBuilder = queryBuilder.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await queryBuilder;

    if (error) throw error;

    return {
      items: data || [],
      total: count || 0,
      took: Date.now() - startTime,
      searchMode: 'database'
    };
  } catch (error) {
    console.error('Error in database search:', error);
    return {
      items: [],
      total: 0,
      took: Date.now() - startTime,
      searchMode: 'database'
    };
  }
}

/**
 * For admin use: manually trigger Elasticsearch sync
 */
export async function syncElasticsearch(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('admin_sync_elasticsearch');

    if (error) throw error;

    // Clear the status cache to force a refresh
    cachedStatus = null;

    return data;
  } catch (error) {
    console.error('Error syncing Elasticsearch:', error);
    throw error;
  }
}

/**
 * For admin use: test Elasticsearch connection
 */
export async function testElasticsearchConnection(): Promise<ElasticsearchStatus> {
  // Clear the cache to force a fresh check
  cachedStatus = null;
  lastStatusCheck = 0;

  // Check the status
  return await checkElasticsearchStatus();
}