// src/pages/Profile.tsx
import React, {useState, useEffect} from 'react';
import {useParams, Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {Star, MessageSquare, Package, Settings, ShoppingBag, Heart} from 'lucide-react';
import {useProfileViews} from '../hooks/useAnalytics';
import {FollowSellerButton} from '../components/FollowSellerButton'; // New import
import {Collections} from '../components/Collections'; // New import

interface Profile {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    bio: string;
    rating: number;
    total_ratings: number;
    is_seller: boolean;
    created_at: string;
}

interface Item {
    id: string;
    title: string;
    price: number;
    condition: string;
    images: string[];
    created_at: string;
}

interface Review {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    reviewer: {
        username: string;
    };
}

interface Transaction {
    id: string;
    item: {
        id: string;
        title: string;
        price: number;
        images: string[];
    };
    seller: {
        username: string;
    };
    status: string;
    created_at: string;
}

export function Profile() {
    const {id} = useParams<{ id: string }>();
    const {user} = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [purchases, setPurchases] = useState<Transaction[]>([]);
    const [activeTab, setActiveTab] = useState<'items' | 'reviews' | 'purchases'>('items');
    const [loading, setLoading] = useState(true);
    const isOwnProfile = user?.id === id;

    // Track profile views
    useProfileViews(id!);

    useEffect(() => {
        if (id) {
            fetchProfile();
            fetchItems();
            fetchReviews();
            if (isOwnProfile) {
                fetchPurchases();
            }
        }
    }, [id]);

    async function fetchProfile() {
        try {
            const {data, error} = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchItems() {
        try {
            const {data, error} = await supabase
                .from('items')
                .select('*')
                .eq('seller_id', id)
                .eq('is_active', true)
                .order('created_at', {ascending: false});

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    }

    async function fetchReviews() {
        try {
            const {data, error} = await supabase
                .from('reviews')
                .select(`
          *,
          reviewer:reviewer_id(username)
        `)
                .eq('reviewed_id', id)
                .order('created_at', {ascending: false});

            if (error) throw error;
            setReviews(data || []);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        }
    }

    async function fetchPurchases() {
        try {
            const {data, error} = await supabase
                .from('transactions')
                .select(`
          *,
          item:item_id(
            id,
            title,
            price,
            images
          ),
          seller:seller_id(
            username
          )
        `)
                .eq('buyer_id', id)
                .order('created_at', {ascending: false});

            if (error) throw error;
            setPurchases(data || []);
        } catch (error) {
            console.error('Error fetching purchases:', error);
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="h-40 bg-gray-200 rounded-lg mb-8"/>
                    <div className="h-8 bg-gray-200 rounded mb-4 w-1/4"/>
                    <div className="h-4 bg-gray-200 rounded mb-8 w-1/2"/>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Array.from({length: 6}).map((_, i) => (
                            <div key={i} className="h-64 bg-gray-200 rounded-lg"/>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Profile Not Found</h2>
                <p className="text-gray-600">
                    The profile you're looking for might have been removed or doesn't exist.
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Profile Header */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32"/>
                <div className="px-6 py-4">
                    <div className="flex items-start">
                        <img
                            src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
                            alt={profile.username}
                            className="w-24 h-24 rounded-full border-4 border-white -mt-12"
                        />
                        <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold">{profile.username}</h1>
                                    {profile.full_name && (
                                        <p className="text-gray-600">{profile.full_name}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isOwnProfile ? (
                                        <Link
                                            to="/settings"
                                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                                        >
                                            <Settings size={18}/>
                                            Edit Profile
                                        </Link>
                                    ) : (
                                        <>
                                            <Link
                                                to={`/messages?user=${id}`}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                                            >
                                                <MessageSquare size={18}/>
                                                Send Message
                                            </Link>
                                            <FollowSellerButton
                                                sellerId={profile.id}/> {/* Added FollowSellerButton */}
                                        </>
                                    )}
                                </div>
                            </div>
                            {profile.bio && (
                                <p className="text-gray-600 mt-2">{profile.bio}</p>
                            )}
                            <div className="flex items-center gap-6 mt-4">
                                <div className="flex items-center gap-1">
                                    <Star className="text-yellow-400" size={20}/>
                                    <span className="font-medium">{profile.rating}</span>
                                    <span className="text-gray-500">
                    ({profile.total_ratings} reviews)
                  </span>
                                </div>
                                {profile.is_seller ? (
                                    <div className="flex items-center gap-1 text-gray-500">
                                        <Package size={20}/>
                                        <span>{items.length} items</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-gray-500">
                                        <ShoppingBag size={20}/>
                                        <span>Buyer</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
                {profile.is_seller && (
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`px-4 py-2 rounded-lg ${
                            activeTab === 'items'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Items
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={`px-4 py-2 rounded-lg ${
                        activeTab === 'reviews'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Reviews
                </button>
                {isOwnProfile && (
                    <button
                        onClick={() => setActiveTab('purchases')}
                        className={`px-4 py-2 rounded-lg ${
                            activeTab === 'purchases'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Purchases
                    </button>
                )}
            </div>

            {/* Content */}
            {activeTab === 'items' && profile.is_seller && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            to={`/items/${item.id}`}
                            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className="aspect-square relative">
                                <img
                                    src={item.images[0] || 'https://via.placeholder.com/400'}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                />
                                <div
                                    className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-sm font-medium">
                                    ${item.price}
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-semibold text-lg mb-1 truncate">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-gray-600">{item.condition}</p>
                            </div>
                        </Link>
                    ))}
                    {items.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No items listed yet
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'reviews' && (
                <div className="space-y-6">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <img
                                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${review.reviewer.username}`}
                                    alt={review.reviewer.username}
                                    className="w-12 h-12 rounded-full"
                                />
                                <div>
                                    <p className="font-medium">{review.reviewer.username}</p>
                                    <div className="flex items-center gap-1">
                                        {Array.from({length: 5}).map((_, i) => (
                                            <Star
                                                key={i}
                                                size={16}
                                                className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <p className="text-gray-600">{review.comment}</p>
                        </div>
                    ))}
                    {reviews.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No reviews yet
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'purchases' && isOwnProfile && (
                <div className="space-y-6">
                    {purchases.map((transaction) => (
                        <div key={transaction.id}
                             className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="flex items-center p-6">
                                <div className="w-24 h-24 rounded-lg overflow-hidden">
                                    <img
                                        src={transaction.item.images[0] || 'https://via.placeholder.com/400'}
                                        alt={transaction.item.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="ml-6 flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold">
                                            {transaction.item.title}
                                        </h3>
                                        <span className="text-lg font-medium">
                      ${transaction.item.price}
                    </span>
                                    </div>
                                    <p className="text-gray-600 mt-1">
                                        Seller: {transaction.seller.username}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        transaction.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : transaction.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                    }`}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </span>
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/items/${transaction.item.id}`}
                                                className="text-indigo-600 hover:text-indigo-700 font-medium"
                                            >
                                                View Item
                                            </Link>
                                            <button className="text-gray-600 hover:text-gray-700">
                                                <Heart size={20}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {purchases.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No purchases yet
                        </div>
                    )}
                </div>
            )}

            {/* Collections for Own Profile */}
            {isOwnProfile && (
                <div className="mt-8">
                    <Collections/>
                </div>
            )}
        </div>
    );
}