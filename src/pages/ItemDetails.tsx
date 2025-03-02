// src/pages/ItemDetails.tsx
import React, {useState, useEffect} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {MessageSquare, Heart, Share2, AlertTriangle} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';
import {useItemViews} from '../hooks/useAnalytics';
import {trackItemView} from '../lib/recommendations';
import {SimilarItems} from '../components/SimilarItems';
import {RecentlyViewedItems} from '../components/RecentlyViewedItems';

interface Item {
    id: string;
    title: string;
    description: string;
    price: number;
    condition: string;
    selling_method: string;
    images: string[];
    created_at: string;
    views: number;
    seller: {
        id: string;
        username: string;
        rating: number;
        total_ratings: number;
    };
}

export function ItemDetails() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const {user} = useAuth();
    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [offerAmount, setOfferAmount] = useState('');
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [error, setError] = useState('');
    const [viewerCount, setViewerCount] = useState(0);

    // Track item views for analytics
    useItemViews(id!);

    useEffect(() => {
        if (id) {
            fetchItem();
            fetchViewerCount();

            // Track view for recommendations
            if (user) {
                trackItemView(id);
            }
        }
    }, [id, user]);

    async function fetchItem() {
        try {
            setLoading(true);
            const {data, error} = await supabase
                .from('items')
                .select(`
          *,
          seller:seller_id (
            id,
            username,
            rating,
            total_ratings
          )
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setItem(data);
        } catch (error) {
            console.error('Error fetching item:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchViewerCount() {
        try {
            const {data, error} = await supabase.rpc('get_unique_item_viewers', {
                item_id: id
            });

            if (error) throw error;
            setViewerCount(data || 0);
        } catch (error) {
            console.error('Error fetching viewer count:', error);
        }
    }

    async function handleMakeOffer() {
        if (!user) {
            navigate('/auth');
            return;
        }

        try {
            setError('');
            const {error} = await supabase
                .from('offers')
                .insert({
                    item_id: id,
                    buyer_id: user.id,
                    amount: parseFloat(offerAmount),
                    status: 'pending'
                });

            if (error) throw error;

            // Create notification for seller
            await supabase.rpc('create_notification', {
                user_id: item?.seller.id,
                title: 'New Offer',
                content: `You received a new offer of $${offerAmount} for "${item?.title}"`
            });

            setShowOfferForm(false);
            setOfferAmount('');
        } catch (error) {
            console.error('Error making offer:', error);
            setError('Failed to submit offer. Please try again.');
        }
    }

    async function handleContactSeller() {
        if (!user) {
            navigate('/auth');
            return;
        }

        try {
            setError('');
            const {error} = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: item?.seller.id,
                    item_id: id,
                    content: `Hi, I'm interested in "${item?.title}"`
                });

            if (error) throw error;
            navigate('/messages');
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message. Please try again.');
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="h-96 bg-gray-200 rounded-lg mb-8"/>
                    <div className="h-8 bg-gray-200 rounded mb-4"/>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"/>
                    <div className="h-24 bg-gray-200 rounded mb-8"/>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4"/>
                <h2 className="text-2xl font-bold mb-2">Item Not Found</h2>
                <p className="text-gray-600 mb-4">
                    The item you're looking for might have been removed or doesn't exist.
                </p>
                <button
                    onClick={() => navigate('/browse')}
                    className="text-indigo-600 hover:text-indigo-700"
                >
                    Browse Other Items →
                </button>
            </div>
        );
    }

    const isOwnItem = user?.id === item.seller.id;

    return (
        <div className="container mx-auto px-4 py-8">
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertTriangle size={20}/>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Images */}
                <div>
                    <div className="aspect-square rounded-lg overflow-hidden mb-4">
                        <img
                            src={item.images[selectedImage] || 'https://via.placeholder.com/800'}
                            alt={item.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {item.images.length > 1 && (
                        <div className="grid grid-cols-4 gap-4">
                            {item.images.map((image, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImage(index)}
                                    className={`aspect-square rounded-lg overflow-hidden ${
                                        selectedImage === index
                                            ? 'ring-2 ring-indigo-500'
                                            : 'opacity-75 hover:opacity-100'
                                    }`}
                                >
                                    <img
                                        src={image}
                                        alt={`${item.title} - Image ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div>
                    <h1 className="text-3xl font-bold mb-2">{item.title}</h1>
                    <div className="flex items-center gap-4 mb-2">
                        <span className="text-2xl font-bold">${item.price}</span>
                        <span className="text-gray-600">
              Condition: {item.condition.replace('_', ' ')}
            </span>
                    </div>
                    <div className="text-gray-600 mb-6">
                        {item.views} views • {viewerCount} unique visitors
                    </div>

                    <div className="prose max-w-none mb-8">
                        <p>{item.description}</p>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                        <img
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${item.seller.username}`}
                            alt={item.seller.username}
                            className="w-12 h-12 rounded-full"
                        />
                        <div>
                            <p className="font-medium">{item.seller.username}</p>
                            <p className="text-sm text-gray-600">
                                ★ {item.seller.rating} ({item.seller.total_ratings} ratings)
                            </p>
                        </div>
                    </div>

                    {!isOwnItem ? (
                        <div className="space-y-4">
                            {item.selling_method === 'fixed' ? (
                                <button
                                    onClick={handleContactSeller}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700"
                                >
                                    Buy Now
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowOfferForm(!showOfferForm)}
                                        className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700"
                                    >
                                        Make an Offer
                                    </button>
                                    {showOfferForm && (
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <input
                                                type="number"
                                                value={offerAmount}
                                                onChange={(e) => setOfferAmount(e.target.value)}
                                                placeholder="Enter your offer amount"
                                                className="w-full mb-2 p-2 border rounded"
                                            />
                                            <button
                                                onClick={handleMakeOffer}
                                                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                                            >
                                                Submit Offer
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            <button
                                onClick={handleContactSeller}
                                className="w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                            >
                                <MessageSquare size={20}/>
                                Contact Seller
                            </button>

                            <div className="flex gap-4">
                                <button
                                    className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                                    <Heart size={20}/>
                                    Save
                                </button>
                                <button
                                    className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                                    <Share2 size={20}/>
                                    Share
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-gray-600">This is your item listing</p>
                            <button
                                onClick={() => navigate('/messages')}
                                className="mt-2 text-indigo-600 hover:text-indigo-700"
                            >
                                View Messages →
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Similar Items */}
            <SimilarItems itemId={id!}/>

            {/* Recently Viewed Items */}
            {user && <RecentlyViewedItems/>}
        </div>
    );
}