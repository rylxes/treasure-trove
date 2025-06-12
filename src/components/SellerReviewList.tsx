import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Define the structure of a seller review object based on get_seller_reviews
interface SellerReview {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  reviewed_id: string; // This is the seller_user_id
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_username: string | null;
  reviewer_avatar_url: string | null;
}

interface SellerReviewListProps {
  sellerUserId: string;
  refreshKey?: number; // Optional key to trigger re-fetch
}

const SellerReviewList: React.FC<SellerReviewListProps> = ({ sellerUserId, refreshKey }) => {
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const reviewsPerPage = 5; // Or make this a prop

  const fetchSellerReviews = useCallback(async (currentPage: number, loadMore = false) => {
    if (!sellerUserId) {
      setReviews([]); // Clear reviews if no sellerUserId
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null); // Clear previous errors

    try {
      const { data, error: rpcError } = await supabase.rpc('get_seller_reviews', {
        p_seller_user_id: sellerUserId,
        p_page: currentPage,
        p_limit: reviewsPerPage,
      });

      if (rpcError) {
        throw rpcError;
      }

      if (data) {
        setReviews(prevReviews => loadMore ? [...prevReviews, ...data] : data);
        setHasMore(data.length === reviewsPerPage);
      } else {
        setHasMore(false); // No data means no more pages
        if (!loadMore) { // If initial load and no data, clear reviews
          setReviews([]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching seller reviews:', err);
      setError(err.message || 'Failed to fetch seller reviews.');
      if (!loadMore) { // If error on initial load, clear reviews
        setReviews([]);
      }
      setHasMore(false); // Stop further loading on error
    } finally {
      setIsLoading(false);
    }
  }, [sellerUserId, reviewsPerPage]); // Removed 'reviews' from dependencies

  useEffect(() => {
    setReviews([]); // Clear reviews on ID or key change
    setPage(1);     // Reset page
    setHasMore(true); // Assume more pages initially
    if (sellerUserId) {
        fetchSellerReviews(1, false); // Fetch first page
    } else {
        // If no sellerUserId, ensure everything is reset
        setReviews([]);
        setHasMore(false);
        setIsLoading(false); // Explicitly set loading to false
    }
    // fetchSellerReviews is stable due to useCallback and its limited dependencies
  }, [sellerUserId, refreshKey, fetchSellerReviews]);

  const loadMoreReviews = () => {
    if (hasMore && !isLoading && sellerUserId) { // Ensure sellerUserId is present
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSellerReviews(nextPage, true);
    }
  };

  if (!sellerUserId) {
    return <p>No seller specified to load reviews for.</p>; // Or null, or some other placeholder
  }

  if (isLoading && reviews.length === 0) {
    return <p>Loading seller reviews...</p>;
  }

  if (error && reviews.length === 0) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  if (reviews.length === 0) {
    return <p>This seller has no reviews yet.</p>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Seller Reviews</h3>
      {reviews.map((review) => (
        <div key={review.id} className="p-4 border rounded-lg shadow-sm bg-white">
          <div className="flex items-center mb-2">
            {review.reviewer_avatar_url ? (
              <img src={review.reviewer_avatar_url} alt={review.reviewer_username || 'Reviewer avatar'} className="w-10 h-10 rounded-full mr-3" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3 text-white text-xl">
                {review.reviewer_username ? review.reviewer_username.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <div>
              <p className="font-semibold">{review.reviewer_username || 'Anonymous Buyer'}</p>
              <p className="text-xs text-gray-500">Reviewed on: {new Date(review.created_at).toLocaleDateString()}</p>
              <p className="text-xs text-gray-500">Based on Transaction ID: {review.transaction_id}</p>
            </div>
          </div>
          <div className="flex items-center mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-xl ${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                ★
              </span>
            ))}
          </div>
          {review.comment && <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>}
        </div>
      ))}
      {hasMore && (
        <button
          onClick={loadMoreReviews}
          disabled={isLoading}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
        >
          {isLoading ? 'Loading...' : 'Load More Seller Reviews'}
        </button>
      )}
      {error && reviews.length > 0 && <p className="text-red-500 mt-2">Error loading more reviews: {error}</p>}
    </div>
  );
};

export default SellerReviewList;
