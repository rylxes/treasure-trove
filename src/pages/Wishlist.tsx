// src/pages/Wishlist.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Loader, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WishListButton } from '../components/WishListButton';

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  condition: string;
  images: string[];
  added_at: string;
}

export function Wishlist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchWishlistItems();
  }, [user]);

  async function fetchWishlistItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_wishlist_items', { limit_val: 50, offset_val: 0 });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching wishlist items:', error);
      setError('Failed to load wishlist items. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader size={40} className="animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading your wishlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchWishlistItems}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Heart className="text-red-500" />
          My Wishlist
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-lg text-center">
          <Heart size={64} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
          <p className="text-gray-600 mb-6">Save items you're interested in by clicking the heart icon</p>
          <Link
            to="/browse"
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Browse Items
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <Link to={`/items/${item.id}`} className="block">
                <div className="aspect-square relative">
                  <img
                    src={item.images[0] || 'https://via.placeholder.com/400'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-sm font-medium">
                    ${item.price}
                  </div>
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/items/${item.id}`} className="block">
                  <h3 className="font-semibold text-lg mb-1 truncate">{item.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{item.condition.replace('_', ' ')}</p>
                </Link>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    Added {new Date(item.added_at).toLocaleDateString()}
                  </p>
                  <WishListButton itemId={item.id} showText={false} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}