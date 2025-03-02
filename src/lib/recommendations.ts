// src/lib/recommendations.ts
import {supabase} from './supabase';

// Interface for recommendation item
export interface RecommendationItem {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
  recommendation_score?: number;
  similarity_score?: number;
  view_count?: number;
  viewed_at?: string;
}

/**
 * Track when a user views an item
 */
export async function trackItemView(itemId: string): Promise<void> {
  try {
    // First track the item view for analytics
    await supabase.rpc('track_item_view', {
      viewed_item_id: itemId
    });

    // Then track for recommendations
    await supabase.rpc('track_viewed_item', {
      viewed_item_id: itemId
    });
  } catch (error) {
    console.error('Error tracking item view:', error);
  }
}

/**
 * Get recently viewed items for the current user
 */
export async function getRecentlyViewedItems(limit: number = 8): Promise<RecommendationItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_recently_viewed_items', {
      limit_val: limit
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching recently viewed items:', error);
    return [];
  }
}

/**
 * Get similar items for a specific item
 */
export async function getSimilarItems(itemId: string, limit: number = 8): Promise<RecommendationItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_similar_items', {
      item_id: itemId,
      limit_val: limit
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching similar items:', error);
    return [];
  }
}

/**
 * Get personalized recommendations for the current user
 */
export async function getPersonalizedRecommendations(limit: number = 10): Promise<RecommendationItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_recommended_items', {
      recommendation_type: 'personalized',
      limit_val: limit
    });

    if (error) throw error;

    // If no personalized recommendations, fall back to popular
    if (!data || data.length === 0) {
      return getPopularRecommendations(limit);
    }

    return data;
  } catch (error) {
    console.error('Error fetching personalized recommendations:', error);
    // Fall back to popular recommendations on error
    return getPopularRecommendations(limit);
  }
}

/**
 * Get popular recommendations
 */
export async function getPopularRecommendations(limit: number = 10): Promise<RecommendationItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_recommended_items', {
      recommendation_type: 'popular',
      limit_val: limit
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching popular recommendations:', error);
    return [];
  }
}

/**
 * For admin use: manually trigger recommendations update
 */
export async function updateRecommendations(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('admin_update_recommendations');

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating recommendations:', error);
    throw error;
  }
}