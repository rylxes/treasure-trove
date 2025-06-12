import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Assuming supabase client

// Define the structure of a review object based on the get_item_reviews function
interface Review {
  id: string;
  item_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
  username: string | null;
  avatar_url: string | null;
}

interface ItemReviewListProps {
  itemId: string;
  refreshKey?: number; // Optional key to trigger re-fetch
}

const ItemReviewList: React.FC<ItemReviewListProps> = ({ itemId, refreshKey }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const reviewsPerPage = 5; // Or make this a prop

  const fetchReviews = useCallback(async (currentPage: number, loadMore = false) => {
    if (!itemId) {
      setReviews([]);
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null); // Clear previous errors for new fetch operation

    try {
      const { data, error: rpcError } = await supabase.rpc('get_item_reviews', {
        p_item_id: itemId,
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
        // No data typically means end of list for the current page
        setHasMore(false);
        if (!loadMore) { // If it's an initial load (not loading more) and no data, clear reviews
            setReviews([]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      setError(err.message || 'Failed to fetch reviews.');
      // If an error occurs on initial load, clear reviews.
      // If error on "load more", existing reviews are kept. Error message will be shown.
      if (!loadMore) {
          setReviews([]);
      }
      setHasMore(false); // Stop further loading attempts on error
    } finally {
      setIsLoading(false);
    }
  }, [itemId, reviewsPerPage]); // 'reviews' removed, 'page' removed as currentPage is a param

  // Effect for initial load and when itemId or refreshKey changes
  useEffect(() => {
    setReviews([]); // Clear existing reviews immediately
    setPage(1);     // Reset to page 1
    setHasMore(true); // Assume there might be data
    if (itemId) {
      fetchReviews(1, false); // Fetch first page of new item
    } else {
      // If itemId becomes null or undefined, clear reviews and stop.
      setReviews([]);
      setHasMore(false);
      setIsLoading(false); // Ensure loading is also false
    }
    // fetchReviews is stable due to useCallback and its limited dependencies (itemId, reviewsPerPage)
    // reviewsPerPage is constant. itemId changing triggers this effect.
  }, [itemId, refreshKey, fetchReviews]);


  const loadMoreReviews = () => {
    if (hasMore && !isLoading && itemId) { // Ensure itemId is present
      const nextPage = page + 1;
      setPage(nextPage); // Update page state
      fetchReviews(nextPage, true); // Fetch next page
    }
  };

  // Adjusted loading condition: Show loading if isLoading is true AND it's an initial load (page === 1 or reviews.length === 0)
  if (isLoading && page === 1 && reviews.length === 0) {
    return <p>Loading reviews...</p>;
  }

  if (error && reviews.length === 0) { // Show error only if no reviews could be loaded initially
    return <p className="text-red-500">Error: {error}</p>;
  }

  if (reviews.length === 0) {
    return <p>No reviews yet for this item.</p>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Customer Reviews</h3>
      {reviews.map((review) => (
        <div key={review.id} className="p-4 border rounded-lg shadow-sm bg-white">
          <div className="flex items-center mb-2">
            {review.avatar_url ? (
              <img src={review.avatar_url} alt={review.username || 'User avatar'} className="w-10 h-10 rounded-full mr-3" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3 text-white text-xl">
                {review.username ? review.username.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <div>
              <p className="font-semibold">{review.username || 'Anonymous'}</p>
              <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-xl ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>
                ★
              </span>
            ))}
          </div>
          {review.review_text && <p className="text-gray-700 whitespace-pre-wrap">{review.review_text}</p>}
        </div>
      ))}
      {hasMore && (
        <button
          onClick={loadMoreReviews}
          disabled={isLoading}
          className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100"
        >
          {isLoading ? 'Loading...' : 'Load More Reviews'}
        </button>
      )}
       {error && reviews.length > 0 && <p className="text-red-500 mt-2">Error loading more reviews: {error}</p>}
    </div>
  );
};

export default ItemReviewList;
