// src/components/WishlistCount.tsx
import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {Heart} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';

export function WishlistCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchWishlistCount();

      // Subscribe to changes in the wish_list_items table
      const subscription = supabase
        .channel('wish_list_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'wish_list_items',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchWishlistCount();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  async function fetchWishlistCount() {
    try {
      const { count, error } = await supabase
        .from('wish_list_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      if (error) throw error;
      setCount(count || 0);
    } catch (error) {
      console.error('Error fetching wishlist count:', error);
    }
  }

  if (!user) return null;

  return (
    <Link to="/wishlist" className="relative text-gray-700 hover:text-indigo-600">
      <Heart size={20} />
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}