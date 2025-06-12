import React, { useState } from 'react';
import { supabase } from '../lib/supabase'; // Assuming supabase client is here
import { useAuth } from '../contexts/AuthContext'; // Assuming an AuthContext provides user info

interface ItemReviewFormProps {
  itemId: string;
  onReviewSubmitted: () => void; // Callback to refresh reviews list or give feedback
}

const ItemReviewForm: React.FC<ItemReviewFormProps> = ({ itemId, onReviewSubmitted }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setError('You must be logged in to submit a review.');
      return;
    }
    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('submit_item_review', {
        p_item_id: itemId,
        p_rating: rating,
        p_review_text: reviewText,
      });

      if (rpcError) {
        throw rpcError;
      }

      setSuccessMessage('Review submitted successfully!');
      setRating(0);
      setReviewText('');
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <p>Please log in to leave a review.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg shadow">
      <h3 className="text-lg font-semibold">Leave a Review</h3>
      {error && <p className="text-red-500">{error}</p>}
      {successMessage && <p className="text-green-500">{successMessage}</p>}

      <div>
        <label htmlFor="rating" className="block text-sm font-medium text-gray-700">Your Rating:</label>
        <div className="flex space-x-1 mt-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              onClick={() => handleRatingChange(star)}
              className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
              aria-label={`Rate ${star} out of 5 stars`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="reviewText" className="block text-sm font-medium text-gray-700">Your Review (Optional):</label>
        <textarea
          id="reviewText"
          name="reviewText"
          rows={3}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
};

export default ItemReviewForm;
