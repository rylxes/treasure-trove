// src/components/WishListButton.tsx
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface WishListButtonProps {
  itemId: string;
  size?: number;
  showText?: boolean;
  className?: string;
}

export function WishListButton({
  itemId,
  size = 20,
  showText = true,
  className = ''
}: WishListButtonProps) {
  const { user } = useAuth();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkWishlistStatus();
    }
  }, [user, itemId]);

  async function checkWishlistStatus() {
    try {
      const { data, error } = await supabase
        .rpc('is_in_wishlist', { item_id: itemId });

      if (error) throw error;
      setIsInWishlist(data || false);
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    }
  }

  async function handleToggleWishlist() {
    if (!user) {
      // Redirect to auth page if not logged in
      window.location.href = '/auth';
      return;
    }

    setLoading(true);
    try {
      if (isInWishlist) {
        const { error } = await supabase
          .rpc('remove_from_wishlist', { item_id: itemId });

        if (error) throw error;
        setIsInWishlist(false);
      } else {
        const { error } = await supabase
          .rpc('add_to_wishlist', { item_id: itemId });

        if (error) throw error;
        setIsInWishlist(true);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    } finally {
      setLoading(false);
    }
  }

  const buttonClasses = `${className} flex items-center gap-2 ${
    isInWishlist 
      ? 'text-red-600 hover:text-red-500' 
      : 'text-gray-600 hover:text-gray-500'
  }`;

  if (!user) {
    return (
      <button
        onClick={() => window.location.href = '/auth'}
        className={buttonClasses}
        aria-label="Save to Wishlist"
      >
        <Heart size={size} />
        {showText && <span>Save</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleWishlist}
      disabled={loading}
      className={buttonClasses}
      aria-label={isInWishlist ? "Remove from Wishlist" : "Save to Wishlist"}
    >
      <Heart size={size} fill={isInWishlist ? 'currentColor' : 'none'} />
      {showText && (
        <span>{isInWishlist ? 'Saved' : 'Save'}</span>
      )}
    </button>
  );
}