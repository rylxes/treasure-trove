import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Add to src/lib/supabase.ts
export async function followSeller(sellerId: string) {
  const { data, error } = await supabase
    .from('seller_followers')
    .insert({ seller_id: sellerId });

  if (error) throw error;
  return data;
}

export async function unfollowSeller(sellerId: string) {
  const { error } = await supabase
    .from('seller_followers')
    .delete()
    .eq('seller_id', sellerId);

  if (error) throw error;
}

export async function getFollowedSellers() {
  const { data, error } = await supabase.rpc('get_followed_sellers');
  if (error) throw error;
  return data;
}

// Add to src/lib/supabase.ts
export async function saveSearch(params: {
  name: string;
  query: string;
  filters: Record<string, any>;
  notifyEmail?: boolean;
  notifyPush?: boolean;
}) {
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      name: params.name,
      query: params.query,
      filters: params.filters,
      notify_email: params.notifyEmail,
      notify_push: params.notifyPush,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSavedSearches() {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteSavedSearch(id: string) {
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Add to src/lib/supabase.ts
export async function createCollection(name: string, description?: string, isPublic: boolean = false) {
  const { data, error } = await supabase
    .from('collections')
    .insert({ name, description, is_public: isPublic })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addToCollection(collectionId: string, itemId: string) {
  const { data, error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, item_id: itemId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserCollections() {
  const { data, error } = await supabase
    .from('collections')
    .select('*, collection_items(items(id, title, price, images))')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Add to src/lib/supabase.ts
export async function manageCategory(
  action: 'create' | 'update' | 'delete',
  params: {
    id?: string;
    name: string;
    slug: string;
    parentId?: string;
  }
) {
  const { data, error } = await supabase.rpc('admin_manage_category', {
    category_id: params.id,
    category_name: params.name,
    category_slug: params.slug,
    parent_id: params.parentId,
    action,
  });

  if (error) throw error;
  return data;
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .order('name');

  if (error) throw error;
  return data;
}