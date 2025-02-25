import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useProfileViews(profileId: string) {
  useEffect(() => {
    if (!profileId) return;

    supabase.rpc('track_profile_view', {
      viewed_profile_id: profileId
    });
  }, [profileId]);
}

export function useItemViews(itemId: string) {
  useEffect(() => {
    if (!itemId) return;

    supabase.rpc('track_item_view', {
      viewed_item_id: itemId
    });
  }, [itemId]);
}