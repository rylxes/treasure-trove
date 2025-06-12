import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SellerReviewFormProps {
  sellerUserId: string;
  transactionId: string; // Assuming the review is tied to a specific transaction
  onReviewSubmitted: () => void;
}

const SellerReviewForm: React.FC<SellerReviewFormProps> = ({ sellerUserId, transactionId, onReviewSubmitted }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
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
      setError('Please select a rating for the seller.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: rpcError } = await supabase.rpc('submit_seller_review', {
        p_transaction_id: transactionId,
        p_seller_user_id: sellerUserId,
        p_rating: rating,
        p_review_comment: comment,
      });

      if (rpcError) {
        throw rpcError;
      }

      setSuccessMessage('Seller review submitted successfully!');
      setRating(0);
      setComment('');
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (err: any) {
      console.error('Error submitting seller review:', err);
      setError(err.message || 'Failed to submit seller review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // This form might be conditionally rendered, e.g., only if the user was the buyer in the transaction.
  // For now, basic auth check. The RPC function `submit_seller_review` does more detailed validation.
  if (!user) {
    return <p>Please log in to leave a review for the seller.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg shadow bg-light-yellow-50"> {/* Example different bg */}
      <h3 className="text-lg font-semibold">Review this Seller</h3>
      <p className="text-sm text-gray-600">Your review is based on transaction ID: {transactionId}</p>
      {error && <p className="text-red-500">{error}</p>}
      {successMessage && <p className="text-green-500">{successMessage}</p>}

      <div>
        <label htmlFor="sellerRating" className="block text-sm font-medium text-gray-700">Seller Rating:</label>
        <div className="flex space-x-1 mt-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              onClick={() => handleRatingChange(star)}
              className={`text-2xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
              aria-label={`Rate seller ${star} out of 5 stars`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="sellerComment" className="block text-sm font-medium text-gray-700">Comment (Optional):</label>
        <textarea
          id="sellerComment"
          name="sellerComment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Submitting...' : 'Submit Seller Review'}
      </button>
    </form>
  );
};

export default SellerReviewForm;
