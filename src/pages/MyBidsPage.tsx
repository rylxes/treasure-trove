// src/pages/MyBidsPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path as needed
import { Link } from 'react-router-dom'; // Assuming react-router-dom for navigation
import { useAuth } from '../contexts/AuthContext'; // To ensure user is logged in

// Interface for the data returned by get_my_bidding_activity
interface MyBidActivityItem {
  item_id: string;
  item_title: string | null;
  item_image_url: string | null;
  item_ends_at: string | null;
  item_is_active: boolean;
  item_selling_method: string; // selling_method enum
  item_current_bid_amount: number | null;
  my_highest_bid_amount: number | null;
  is_my_bid_highest: boolean;
  auction_status: string; // e.g., 'active_leading', 'active_outbid', 'ended_won', 'ended_lost'
}

// Simple Countdown for this page
const SimpleCountdown: React.FC<{ endsAt: string | null }> = ({ endsAt }) => {
  const calculateTimeLeft = useCallback(() => {
    if (!endsAt) return 'No end date';
    const difference = +new Date(endsAt) - +new Date();
    if (difference <= 0) return 'Auction Ended';

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / 1000 / 60) % 60);

    if (days > 0) return `Ends in: ${days}d ${hours}h`;
    if (hours > 0) return `Ends in: ${hours}h ${minutes}m`;
    if (minutes > 0) return `Ends in: ${minutes}m`;
    return 'Ends very soon';
  }, [endsAt]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    if (!endsAt || new Date(endsAt) <= new Date()) {
        setTimeLeft('Auction Ended');
        return;
    }
    // Update immediately and then set interval
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60000); // Update every minute is fine for this overview
    return () => clearInterval(timer);
  }, [endsAt, calculateTimeLeft]);

  return <span className="text-sm text-gray-500">{timeLeft}</span>;
};


const MyBidsPage: React.FC = () => {
  const { user } = useAuth();
  const [biddingActivity, setBiddingActivity] = useState<MyBidActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBiddingActivity = async () => {
      if (!user) {
        setIsLoading(false);
        // Optionally redirect to login or show message
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_my_bidding_activity');
        if (rpcError) throw rpcError;
        setBiddingActivity(data || []);
      } catch (err: any) {
        console.error('Error fetching bidding activity:', err);
        setError(err.message || 'Failed to load your bidding activity.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBiddingActivity();
  }, [user]);

  const getStatusClasses = (status: string, isHighest: boolean | null) => { // isHighest can be null from DB
    if (status === 'active_leading' || (status.startsWith('active') && isHighest === true) ) {
        return 'text-green-600 font-semibold';
    }
    if (status === 'active_outbid' || (status.startsWith('active') && isHighest === false)) {
        return 'text-orange-600 font-semibold';
    }
    if (status === 'ended_won') return 'text-green-700 font-bold';
    if (status === 'ended_lost') return 'text-red-700 font-semibold';
    if (status === 'ended_processing') return 'text-blue-600 font-semibold';
    return 'text-gray-600'; // Default for unknown or other statuses
  };

  const formatStatusText = (status: string) => {
      return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }


  if (isLoading) return <p className="text-center mt-8">Loading your bidding activity...</p>;
  if (error) return <p className="text-center mt-8 text-red-500">Error: {error}</p>;
  if (!user) return <p className="text-center mt-8">Please log in to see your bidding activity.</p>;
  if (biddingActivity.length === 0) return <p className="text-center mt-8">You haven't placed any bids yet, or there was an issue loading them.</p>;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800">My Bidding Activity</h1>
      <div className="space-y-4">
        {biddingActivity.map((activity) => (
          <div key={activity.item_id} className="p-4 border rounded-lg shadow-lg bg-white flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 hover:shadow-xl transition-shadow duration-300">
            <Link to={`/items/${activity.item_id}`} className="flex-shrink-0 w-full sm:w-auto">
              <img
                src={activity.item_image_url || '/placeholder-image.png'}
                alt={activity.item_title || 'Item image'}
                className="w-full sm:w-32 h-48 sm:h-32 object-cover rounded-md hover:opacity-80 transition-opacity"
              />
            </Link>
            <div className="flex-grow min-w-0"> {/* Added min-w-0 for flex child truncation */}
              <Link to={`/items/${activity.item_id}`}>
                <h2 className="text-lg font-semibold hover:text-indigo-600 transition-colors truncate" title={activity.item_title || 'No Title'}>
                  {activity.item_title || 'No Title'}
                </h2>
              </Link>
              <p className={`text-sm ${getStatusClasses(activity.auction_status, activity.is_my_bid_highest)}`}>
                Status: {formatStatusText(activity.auction_status)}
              </p>
              {activity.item_ends_at && (activity.auction_status.startsWith('active') || activity.auction_status === 'ended_processing') && (
                <SimpleCountdown endsAt={activity.item_ends_at} />
              )}
            </div>
            <div className="flex-shrink-0 text-left sm:text-right space-y-1 w-full sm:w-auto md:w-1/4 mt-3 sm:mt-0">
              <p className="text-sm text-gray-700">Your Highest Bid: <span className="font-bold text-blue-700">${activity.my_highest_bid_amount?.toFixed(2) ?? 'N/A'}</span></p>
              <p className="text-sm text-gray-700">Current Top Bid: <span className="font-bold text-green-700">${activity.item_current_bid_amount?.toFixed(2) || 'N/A'}</span></p>
               <Link to={`/items/${activity.item_id}`} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                View Item
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyBidsPage;
