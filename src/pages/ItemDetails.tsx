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

// Import BidList component
import BidList from '../components/BidList';


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
    seller_id: string; // Direct access to seller_id
    seller: { // This is the joined 'profiles' table aliased as 'seller'
        id: string; // This is profiles.id which is items.seller_id
        username: string;
        rating: number; // This is seller's overall rating
        total_ratings: number; // This is seller's overall total ratings
    };
    // Auction specific fields from 'items' table
    ends_at?: string | null;
    current_bid_amount?: number | null;
    bid_count?: number;
    is_active?: boolean; // To determine if auction is ongoing, ended, or processed

    // category_name and seller_username can be added if fetched via joins as in conceptual example
    category_name?: string;
    // seller_username is redundant due to item.seller.username
}


// Countdown Timer Component
const CountdownTimer: React.FC<{ endsAt: string | null | undefined, onAuctionEnd?: () => void }> = ({ endsAt, onAuctionEnd }) => {
  const calculateTimeLeft = React.useCallback(() => { // useCallback to stabilize the function
    if (!endsAt) return null;
    const difference = +new Date(endsAt) - +new Date();
    let timeLeftData = {};

    if (difference > 0) {
      timeLeftData = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    } else {
      // Auction ended
      if (onAuctionEnd) onAuctionEnd();
    }
    return timeLeftData;
  }, [endsAt, onAuctionEnd]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    if (!endsAt || +new Date(endsAt) - +new Date() <= 0) { // Check if already ended
      setTimeLeft(null); // Ensure no timer if ended
      return;
    }

    const timer = setInterval(() => { // Use setInterval for continuous update
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer); // Clear interval on unmount or change
  }, [endsAt, calculateTimeLeft]);

  if (!timeLeft || Object.keys(timeLeft).length === 0) {
    return <span className="text-red-500 font-semibold">Auction Ended</span>;
  }

  const typedTimeLeft = timeLeft as { days: number, hours: number, minutes: number, seconds: number };

  return (
    <span className="text-lg font-semibold text-blue-600">
      {typedTimeLeft.days > 0 && `${typedTimeLeft.days}d `}
      {typedTimeLeft.hours > 0 && `${typedTimeLeft.hours}h `}
      {typedTimeLeft.minutes > 0 && `${typedTimeLeft.minutes}m `}
      {typedTimeLeft.seconds >= 0 ? `${typedTimeLeft.seconds}s left` : '0s left'}
    </span>
  );
};


export function ItemDetails() {
    const {id: itemId} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const {user} = useAuth();
    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [offerAmount, setOfferAmount] = useState('');
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [error, setError] = useState(''); // For general page errors
    const [viewerCount, setViewerCount] = useState(0);

    // State for item reviews
    const [reviewRefreshKey, setReviewRefreshKey] = useState<number>(0);

    // State for bidding
    const [bidAmount, setBidAmount] = useState<string>('');
    const [isBidding, setIsBidding] = useState<boolean>(false);
    const [bidError, setBidError] = useState<string | null>(null);
    const [bidSuccess, setBidSuccess] = useState<string | null>(null);
    const [bidListRefreshKey, setBidListRefreshKey] = useState<number>(0); // For refreshing BidList


    // Track item views for analytics
    useItemViews(itemId!);

    useEffect(() => {
        if (itemId) {
            fetchItemDetails();
            fetchViewerCount();

            if (user) {
                trackItemView(itemId);
            }
        }
    }, [itemId, user]);

    async function fetchItemDetails() {
        if (!itemId) return;
        setLoading(true);
        // Keep existing general error if it's not a new item load, clear only if new item
        // setError(null); // Let's manage this more carefully, perhaps clear only specific errors
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
                .eq('id', itemId)
                .single();

            if (fetchError) throw fetchError;

            setItem(data as Item);
            // Clear bid-specific errors/success messages when item re-fetches
            setBidError(null);
            setBidSuccess(null);

        } catch (err: any) {
            console.error('Error fetching item details:', err);
            setError(err.message || 'Failed to fetch item details.');
        } finally {
            setLoading(false);
        }
    }

    async function fetchViewerCount() {
        if (!itemId) return;
        try {
            const {data, error: rpcError} = await supabase.rpc('get_unique_item_viewers', {
                item_id: itemId,
            });

            if (rpcError) throw rpcError;
            setViewerCount(data || 0);
        } catch (err: any) {
            console.error('Error fetching viewer count:', err);
        }
    }

    const handleReviewSubmitted = () => {
        setReviewRefreshKey(prevKey => prevKey + 1);
        if (itemId) {
            setTimeout(() => fetchItemDetails(), 1000);
        }
    };

    const handlePlaceBid = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!item || !user) return;
      setIsBidding(true);
      setBidError(null);
      setBidSuccess(null);
      try {
        const amount = parseFloat(bidAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error("Invalid bid amount. Must be a positive number.");
        }
        // Client-side check for minimum bid amount (though server RPC also validates)
        const minBid = (item.current_bid_amount ?? item.price) + 0.01;
        if (amount < minBid) {
            throw new Error(`Bid amount must be at least $${minBid.toFixed(2)}.`);
        }

        const { error: rpcError } = await supabase.rpc('place_bid', {
          p_item_id: item.id,
          p_bid_amount: amount,
        });
        if (rpcError) throw rpcError;
        setBidSuccess('Bid placed successfully!');
        setBidAmount('');
        setBidListRefreshKey(prev => prev + 1);
        setTimeout(() => fetchItemDetails(), 500); // Shorter delay, or rely on subscription if implemented
      } catch (err: any) {
        console.error('Error placing bid:', err);
        setBidError(err.message || 'Failed to place bid. Please try again.');
      } finally {
        setIsBidding(false);
      }
    };


    async function handleMakeOffer() {
        if (!user) {
            navigate('/auth');
            return;
        }
        if (!itemId) return;

        try {
            setError('');
            const {error: offerError} = await supabase
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

                    {/* Price / Auction Info Display */}
                    {item.selling_method === 'auction' ? (
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg shadow">
                            <h2 className="text-xl font-bold text-blue-700 mb-3 border-b pb-2">Auction Details</h2>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div>
                                    <p className="text-sm text-gray-600">
                                        {item.current_bid_amount ? 'Current Bid:' : 'Starting Price:'}
                                    </p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ${(item.current_bid_amount ?? item.price).toFixed(2)}
                                    </p>
                                </div>
                                {item.ends_at && item.is_active && (
                                  <div>
                                      <p className="text-sm text-gray-600">Time Remaining:</p>
                                      <CountdownTimer endsAt={item.ends_at} onAuctionEnd={() => setTimeout(() => fetchItemDetails(), 1000)} />
                                  </div>
                                )}
                                <div>
                                    <p className="text-sm text-gray-600">Number of Bids:</p>
                                    <p className="text-lg font-semibold text-gray-800">{item.bid_count || 0}</p>
                                </div>
                                {item.ends_at && new Date(item.ends_at) <= new Date() && item.is_active && (
                                    <p className="text-sm text-orange-600 col-span-2 font-medium">
                                        This auction has ended. Awaiting processing.
                                    </p>
                                )}
                                {!item.is_active && ( // General inactive state for auction
                                    <p className="text-sm text-gray-700 col-span-2 font-medium">
                                        This auction has concluded.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Existing price display for non-auction items
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-700">
                            <span className="text-2xl font-bold text-indigo-600">${item.price.toFixed(2)}</span>
                             {/* Moved condition here for non-auction items, for auctions it's less prominent or can be elsewhere */}
                            <span className="capitalize">
                                Condition: {item.condition.replace('_', ' ')}
                            </span>
                        </div>
                    )}
                    {/* End Price / Auction Info Display */}

                    {/* Condition display for auction items can be here or in main description area */}
                    {item.selling_method === 'auction' && (
                         <p className="text-sm text-gray-600 capitalize">Condition: {item.condition.replace('_', ' ')}</p>
                    )}


                     <UpdateStockStatus
                        itemId={item.id}
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
                                    size="text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                        <PriceHistory itemId={item.id} currentPrice={item.price}/>
                    </div>

                    {/* Bidding Form - Conditional */}
                    {item.selling_method === 'auction' && item.is_active && item.ends_at && new Date(item.ends_at) > new Date() && user && user.id !== item.seller_id && (
                      <form onSubmit={handlePlaceBid} className="mt-6 p-4 border rounded-lg bg-gray-50 shadow-md">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">Place Your Bid</h3>
                        {bidError && <p className="text-red-600 text-sm mb-2 p-2 bg-red-100 rounded">{bidError}</p>}
                        {bidSuccess && <p className="text-green-600 text-sm mb-2 p-2 bg-green-100 rounded">{bidSuccess}</p>}
                        <div className="flex items-stretch space-x-2"> {/* items-stretch for button height */}
                          <div className="relative flex-grow">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={bidAmount}
                              onChange={(e) => setBidAmount(e.target.value)}
                              placeholder={`Min. $${((item.current_bid_amount ?? item.price) + 0.01).toFixed(2)}`}
                              className="w-full pl-7 pr-2 py-2 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                            disabled={isBidding}
                          >
                            {isBidding ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Placing...
                              </>
                            ) : 'Place Bid'}
                          </button>
                        </div>
                         {bidAmount && parseFloat(bidAmount) < ((item.current_bid_amount ?? item.price) + 0.01) && (
                            <p className="text-xs text-red-500 mt-1">
                                Your bid must be at least ${((item.current_bid_amount ?? item.price) + 0.01).toFixed(2)}.
                            </p>
                        )}
                      </form>
                    )}


                    {/* Standard Actions (Buy Now, Make Offer, Contact Seller) */}
                    {/* These should be hidden or adjusted if it's an auction and the user is not the seller,
                        or if the auction is active. For now, keeping existing logic but it might need refinement
                        based on auction status. */}
                    {!isOwnItem && item.selling_method !== 'auction' && ( // Hide if auction for non-owner
                        <div className="space-y-3 pt-4 border-t">
                            {item.selling_method === 'fixed' ? (
                                <button
                                    onClick={handleContactSeller}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Buy Now
                                </button>
                            ) : ( // This assumes 'negotiation' if not 'fixed' and not 'auction'
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

            {/* Bid History for Auctions */}
            {item.selling_method === 'auction' && itemId && (
              <div className="bg-white shadow-xl rounded-lg p-6">
                <BidList itemId={itemId} refreshKey={bidListRefreshKey} />
              </div>
            )}

            {/* Similar Items */}
            {itemId && <SimilarItems itemId={itemId}/>}

            {/* Recently Viewed Items */}
            {user && <RecentlyViewedItems/>}
        </div>
    );
}