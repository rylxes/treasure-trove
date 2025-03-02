// src/components/FollowSellerButton.tsx
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { followSeller, unfollowSeller, getFollowedSellers } from '../lib/supabase';

interface FollowSellerButtonProps {
  sellerId: string;
}

export function FollowSellerButton({ sellerId }: FollowSellerButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkFollowStatus();
    }
  }, [user, sellerId]);

  async function checkFollowStatus() {
    try {
      const followed = await getFollowedSellers();
      setIsFollowing(followed.some(seller => seller.id === sellerId));
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }

  async function handleToggleFollow() {
    if (!user) return;

    setLoading(true);
    try {
      if (isFollowing) {
        await unfollowSeller(sellerId);
        setIsFollowing(false);
      } else {
        await followSeller(sellerId);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <button
      onClick={handleToggleFollow}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        isFollowing 
          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
      }`}
    >
      <Heart size={18} fill={isFollowing ? 'currentColor' : 'none'} />
      <span>{isFollowing ? 'Following' : 'Follow'}</span>
    </button>
  );
}