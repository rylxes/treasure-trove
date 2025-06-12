// src/pages/ItemDetails.tsx
import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {AlertTriangle, MessageSquare} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';
import {useItemViews} from '../hooks/useAnalytics';
import {trackItemView} from '../lib/recommendations';
import {SimilarItems} from '../components/SimilarItems';
import {RecentlyViewedItems} from '../components/RecentlyViewedItems';
import {ShareListing} from '../components/ShareListing'; // New import
import {AddToCollection} from '../components/AddToCollection'; // New import
import {WishListButton} from '../components/WishListButton';
import {PriceAlertButton} from '../components/PriceAlertButton';
import {PriceHistory} from '../components/PriceHistory';
import {StockAlertButton} from '../components/StockAlertButton';
import {UpdateStockStatus} from '../components/UpdateStockStatus';
import {DonateButton} from "../components/DonateButton.tsx";

// Import the new review components
import ItemReviewList from '../components/ItemReviewList';
import ItemReviewForm from '../components/ItemReviewForm';


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
    stock_status: string;
    average_item_rating?: number; // Added for item reviews
    item_review_count?: number;   // Added for item reviews
    // seller details seem to be for seller's overall rating, not specific to this item's seller in context of item reviews
    seller: {
        id: string;
        username: string;
        rating: number; // This is seller's overall rating
        total_ratings: number; // This is seller's overall total ratings
    };
    // category_name and seller_username can be added if fetched via joins as in conceptual example
    category_name?: string;
    seller_username?: string; // This might be redundant if item.seller.username is already there
}

export function ItemDetails() {
    const {id: itemId} = useParams<{ id: string }>(); // Renamed id to itemId for clarity
    const navigate = useNavigate();
    const {user} = useAuth();
    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [offerAmount, setOfferAmount] = useState('');
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [error, setError] = useState(''); // For general page errors
    const [viewerCount, setViewerCount] = useState(0);

    // State to trigger refresh of review list after a new review is submitted
    const [reviewRefreshKey, setReviewRefreshKey] = useState<number>(0);

    // Track item views for analytics
    useItemViews(itemId!); // Use itemId

    useEffect(() => {
        if (itemId) { // Use itemId
            fetchItemDetails(); // Renamed for clarity and to match conceptual example
            fetchViewerCount();

            // Track view for recommendations
            if (user) {
                trackItemView(itemId); // Use itemId
            }
        }
    }, [itemId, user]); // Use itemId

    async function fetchItemDetails() { // Renamed
        if (!itemId) return;
        setLoading(true);
        setError(null);
        try {
            // Fetch item details. Ensure your query selects the new rating fields.
            const {data, error: fetchError} = await supabase
                .from('items')
                .select(`
                    *,
                    average_item_rating,
                    item_review_count,
                    seller:seller_id (
                        id,
                        username,
                        rating,
                        total_ratings
                    )
                `)
                .eq('id', itemId) // Use itemId
                .single();

            if (fetchError) throw fetchError;

            // The data should match the Item interface more directly now
            // if category_name etc. are needed, the select query needs to be adjusted with joins
            // e.g. category:categories(name)
            setItem(data as Item);

        } catch (err: any) {
            console.error('Error fetching item details:', err);
            setError(err.message || 'Failed to fetch item details.');
        } finally {
            setLoading(false);
        }
    }

    async function fetchViewerCount() {
        if (!itemId) return; // Added guard for itemId
        try {
            const {data, error: rpcError} = await supabase.rpc('get_unique_item_viewers', { // Renamed error variable
                item_id: itemId, // Use itemId
            });

            if (rpcError) throw rpcError; // Use rpcError
            setViewerCount(data || 0);
        } catch (err: any) { // Use err
            console.error('Error fetching viewer count:', err); // Use err
        }
    }

    const handleReviewSubmitted = () => {
        setReviewRefreshKey(prevKey => prevKey + 1);
        // Optionally re-fetch item to update average rating display on this page
        // This could be a lighter fetch just for the item's rating fields
        // For now, reviewRefreshKey will make ItemReviewList update.
        // To update the item's average rating displayed here, we can call fetchItemDetails again.
        if (itemId) {
            // A slight delay can give time for the DB trigger to update the average
            setTimeout(() => fetchItemDetails(), 1000);
        }
    };


    async function handleMakeOffer() {
        if (!user) {
            navigate('/auth');
            return;
        }
        if (!itemId) return; // Added guard for itemId

        try {
            setError(''); // Clear general page error
            const {error: offerError} = await supabase // Renamed error variable
                .from('offers')
                .insert({
                    item_id: itemId, // Use itemId
                    buyer_id: user.id,
                    amount: parseFloat(offerAmount),
                    status: 'pending',
                });

            if (offerError) throw offerError; // Use offerError

            // Create notification for seller
            await supabase.rpc('create_notification', {
                user_id: item?.seller.id,
                title: 'New Offer',
                content: `You received a new offer of $${offerAmount} for "${item?.title}"`,
            });

            setShowOfferForm(false);
            setOfferAmount('');
        } catch (err: any) { // Use err
            console.error('Error making offer:', err); // Use err
            setError('Failed to submit offer. Please try again.'); // Set general page error
        }
    }

    async function handleContactSeller() {
        if (!user) {
            navigate('/auth');
            return;
        }
        if (!itemId) return; // Added guard for itemId

        try {
            setError(''); // Clear general page error
            const {error: messageError} = await supabase // Renamed error variable
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: item?.seller.id,
                    item_id: itemId, // Use itemId
                    content: `Hi, I'm interested in "${item?.title}"`,
                });

            if (messageError) throw messageError; // Use messageError
            navigate('/messages');
        } catch (err: any) { // Use err
            console.error('Error sending message:', err); // Use err
            setError('Failed to send message. Please try again.'); // Set general page error
        }
    }

    // Helper to display stars (similar to conceptual example)
    const StarRatingDisplay = ({ rating, count, size = 'text-xl' }: { rating?: number; count?: number; size?: string; }) => {
        if (typeof rating !== 'number' || rating < 0 || rating > 5) { // Validate rating
             // Show "No reviews yet" only if count is explicitly zero or undefined
            if (count === 0 || typeof count === 'undefined') {
                return <span className="text-sm text-gray-500">No reviews yet</span>;
            }
             // If count > 0 but rating is invalid, it's an anomaly, but still show stars based on count or nothing
            return <span className="text-sm text-gray-500">Rating not available</span>;
        }

        const fullStars = Math.floor(rating);
        // Simplified half star: if decimal part is >= 0.25, show half, if >= 0.75 show full (more like rounding)
        // Or just use Math.round(rating) for full stars and adjust empty ones.
        // For simplicity here, we'll stick to floor and explicit half if needed.
        // The conceptual example used a simple Math.floor for full and one half if rating % 1 >= 0.5
        const halfStar = rating % 1 >= 0.25 && rating % 1 < 0.75 ? 1 : 0; // More precise half
        const actualFullStars = rating % 1 >= 0.75 ? fullStars + 1 : fullStars;
        const actualEmptyStars = 5 - actualFullStars - halfStar;

        return (
            <div className="flex items-center">
                {[...Array(actualFullStars)].map((_, i) => <span key={`full-${i}`} className={`text-yellow-400 ${size}`}>★</span>)}
                {halfStar === 1 && <span key="half" className={`text-yellow-400 ${size}`}>☆</span>} {/* Using a different char for half if desired, or use clipping */}
                {[...Array(actualEmptyStars)].map((_, i) => <span key={`empty-${i}`} className={`text-gray-300 ${size}`}>★</span>)}
                {typeof count === 'number' && <span className="ml-2 text-sm text-gray-600">({count} review{count === 1 ? '' : 's'})</span>}
            </div>
        );
    };


    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="h-96 bg-gray-200 rounded-lg mb-8 animate-pulse"/>
                    <div className="h-8 bg-gray-200 rounded mb-4 animate-pulse"/>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-8 animate-pulse"/>
                    <div className="h-24 bg-gray-200 rounded mb-8 animate-pulse"/>
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
        <div className="container mx-auto px-4 py-8 space-y-8"> {/* Added space-y-8 for overall spacing */}
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={20}/>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* Changed to 3 columns for layout adjustment */}
                {/* Images - takes 2 columns on lg screens */}
                <div className="lg:col-span-2">
                    <div className="aspect-square rounded-lg overflow-hidden mb-4 shadow-lg">
                        <img
                            src={item.images && item.images.length > 0 ? item.images[selectedImage] : 'https://via.placeholder.com/800'}
                            alt={item.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {item.images && item.images.length > 1 && (
                        <div className="grid grid-cols-4 gap-2 sm:gap-4"> {/* Smaller gap for thumbnails */}
                            {item.images.map((image, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImage(index)}
                                    className={`aspect-square rounded-lg overflow-hidden border-2 ${
                                        selectedImage === index
                                            ? 'border-indigo-500 ring-2 ring-indigo-500' // Enhanced selection display
                                            : 'border-transparent opacity-75 hover:opacity-100 hover:border-gray-300'
                                    } transition-all`}
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

                {/* Details - takes 1 column on lg screens */}
                <div className="bg-white p-6 rounded-lg shadow-xl space-y-4"> {/* Added card styling */}
                    <h1 className="text-3xl font-bold">{item.title}</h1>

                    {/* Item Average Rating Display */}
                    <div className="my-2">
                        <StarRatingDisplay rating={item.average_item_rating} count={item.item_review_count} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-700">
                        <span className="text-2xl font-bold text-indigo-600">${item.price.toFixed(2)}</span>
                        <span className="capitalize">
                            Condition: {item.condition.replace('_', ' ')}
                        </span>
                        {/* Category could be displayed here if fetched and available in Item type */}
                        {/* <span className="capitalize">Category: {item.category_name || 'N/A'}</span> */}
                    </div>

                     <UpdateStockStatus
                        itemId={item.id} // item.id should be correct as item is not null here
                        currentStatus={item.stock_status}
                        isSeller={isOwnItem}
                        onUpdate={(newStatus) => setItem(prevItem => prevItem ? {...prevItem, stock_status: newStatus} : null)}
                    />

                    <div className="text-sm text-gray-500">
                        {item.views} views • {viewerCount} unique visitors
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <h2 className="text-lg font-semibold mb-2">Seller Information</h2>
                        <div className="flex items-center gap-3">
                            <img
                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${item.seller.username}`}
                                alt={item.seller.username}
                                className="w-10 h-10 rounded-full bg-gray-200" // Added bg for placeholder
                            />
                            <div>
                                <p
                                    className="font-medium text-indigo-600 hover:underline cursor-pointer"
                                    onClick={() => item.seller?.id && navigate(`/profile/${item.seller.id}`)}
                                >
                                    {item.seller.username || 'Anonymous Seller'}
                                </p>
                                {/* Use StarRatingDisplay for seller's overall rating */}
                                <StarRatingDisplay
                                    rating={item.seller.rating}
                                    count={item.seller.total_ratings}
                                    size="text-sm" // Smaller size for seller section
                                />
                            </div>
                        </div>
                    </div>

                    {/* PriceHistory is already here, ensure it's distinct from seller info block */}
                    <div className="mt-4 border-t pt-4"> {/* Added margin top and border for separation */}
                        <PriceHistory itemId={item.id} currentPrice={item.price}/>
                    </div>

                    {!isOwnItem ? (
                        <div className="space-y-3 pt-4 border-t">
                            {item.selling_method === 'fixed' ? (
                                <button
                                    onClick={handleContactSeller} // Consider renaming to handleBuyNow if it leads to a checkout
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Buy Now
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowOfferForm(!showOfferForm)}
                                        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        {showOfferForm ? 'Cancel Offer' : 'Make an Offer'}
                                    </button>
                                    {showOfferForm && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <input
                                                type="number"
                                                value={offerAmount}
                                                onChange={(e) => setOfferAmount(e.target.value)}
                                                placeholder="Enter your offer amount"
                                                className="w-full mb-3 p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <button
                                                onClick={handleMakeOffer}
                                                className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition-colors"
                                            >
                                                Submit Offer
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            <button
                                onClick={handleContactSeller}
                                className="w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <MessageSquare size={18}/>
                                Contact Seller
                            </button>

                            <div className="flex justify-around items-center pt-2"> {/* Centered and spaced tools */}
                                <AddToCollection itemId={item.id}/>
                                <WishListButton itemId={item.id} size={22}/>
                                <PriceAlertButton itemId={item.id} price={item.price} size={22}/>
                                <StockAlertButton itemId={item.id} stockStatus={item.stock_status} size={22}/>
                            </div>
                             <div className="pt-2">
                                <ShareListing itemId={item.id} title={item.title}/>
                             </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                            <p className="text-gray-700 mb-3 font-semibold">This is your item listing.</p>
                            <div className="flex flex-col gap-2">
                                <ShareListing itemId={item.id} title={item.title}/>
                                <DonateButton itemId={item.id}/>
                                {/* UpdateStockStatus is already shown above for seller */}
                                <button
                                    onClick={() => navigate('/messages')}
                                    className="w-full border border-indigo-600 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                >
                                    View Messages & Offers
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Item Description (moved below image/details grid for better flow) */}
            <div className="bg-white shadow-xl rounded-lg p-6">
                <h2 className="text-2xl font-semibold mb-3 border-b pb-2">Description</h2>
                <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 whitespace-pre-wrap">
                    {item.description || "No description provided."}
                </div>
            </div>

            {/* Item Reviews Section */}
            {itemId && ( // Ensure itemId is available before rendering review components
              <>
                <div className="bg-white shadow-xl rounded-lg p-6">
                    <ItemReviewForm itemId={itemId} onReviewSubmitted={handleReviewSubmitted} />
                </div>

                <div className="bg-white shadow-xl rounded-lg p-6">
                    <ItemReviewList itemId={itemId} refreshKey={reviewRefreshKey} />
                </div>
              </>
            )}

            {/* Similar Items */}
            {itemId && <SimilarItems itemId={itemId}/>}

            {/* Recently Viewed Items */}
            {user && <RecentlyViewedItems/>}
        </div>
    );
}