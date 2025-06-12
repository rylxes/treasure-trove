// src/components/BidList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path as needed

interface Bid {
  id: string;
  bid_amount: number;
  created_at: string;
  bidder_username: string | null;
  bidder_avatar_url: string | null; // Included in get_item_bids RPC
}

interface BidListProps {
  itemId: string;
  refreshKey?: number;
  onBidsLoaded?: (bidCount: number) => void; // Optional: if parent needs total count not just from item
}

const BidList: React.FC<BidListProps> = ({ itemId, refreshKey }) => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const bidsPerPage = 5;

  const fetchBids = useCallback(async (currentPage: number, loadMore = false) => {
    if (!itemId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_item_bids', {
        p_item_id: itemId,
        p_page: currentPage,
        p_limit: bidsPerPage,
      });
      if (rpcError) throw rpcError;
      if (data) {
        setBids(prevBids => loadMore ? [...prevBids, ...data] : data);
        setHasMore(data.length === bidsPerPage);
      } else {
        setHasMore(false);
        if (!loadMore) setBids([]); // Clear if initial load yields no data
      }
    } catch (err: any) {
      console.error('Error fetching bids:', err);
      setError(err.message || 'Failed to fetch bids.');
      if (!loadMore) setBids([]); // Clear on error for initial load
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [itemId, bidsPerPage]); // Removed 'bids' from deps

  useEffect(() => {
    setBids([]); // Clear previous bids
    setPage(1);   // Reset page
    setHasMore(true); // Assume there are bids initially
    if (itemId) {
        fetchBids(1, false); // Fetch first page
    } else {
        // If no itemId, clear everything
        setBids([]);
        setHasMore(false);
        setIsLoading(false);
    }
    // fetchBids is stable due to useCallback and its limited dependencies
  }, [itemId, refreshKey, fetchBids]);


  const loadMoreBids = () => {
    if (hasMore && !isLoading && itemId) { // Check itemId
      const nextPage = page + 1;
      setPage(nextPage);
      fetchBids(nextPage, true);
    }
  };

  if (isLoading && bids.length === 0) return <p>Loading bids...</p>;
  if (error && bids.length === 0) return <p className="text-red-500">Error: {error}</p>;
  if (bids.length === 0) return <p>No bids placed yet.</p>;

  return (
    <div className="mt-6">
      <h4 className="text-lg font-semibold mb-3">Bid History</h4>
      <ul className="space-y-3">
        {bids.map(bid => (
          <li key={bid.id} className="p-3 border rounded-md bg-gray-50 flex justify-between items-center shadow-sm">
            <div className="flex items-center">
              {bid.bidder_avatar_url ? (
                 <img src={bid.bidder_avatar_url} alt={bid.bidder_username || 'Bidder'} className="w-8 h-8 rounded-full mr-3"/>
              ) : (
                 <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3 text-white text-sm">
                   {bid.bidder_username ? bid.bidder_username.charAt(0).toUpperCase() : '?'}
                 </div>
              )}
              <div>
                <span className="font-semibold text-gray-800">{bid.bidder_username || 'Anonymous Bidder'}</span>
                <p className="text-xs text-gray-500">
                  {new Date(bid.created_at).toLocaleDateString()} {new Date(bid.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <span className="text-lg font-bold text-green-600">${bid.bid_amount.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={loadMoreBids}
          disabled={isLoading}
          className="mt-4 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
        >
          {isLoading ? 'Loading...' : 'Load More Bids'}
        </button>
      )}
      {error && bids.length > 0 && <p className="text-red-500 text-sm mt-2">Error loading more bids: {error}</p>}
    </div>
  );
};
export default BidList;
