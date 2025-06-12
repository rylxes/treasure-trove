// src/components/SearchResultItem.tsx
import {Link} from 'react-router-dom';
import {SearchItem} from '../lib/elasticsearch';
import {SearchHighlight} from './SearchHighlight';

interface SearchResultItemProps {
    item: SearchItem;
    searchTerm: string;
}

export function SearchResultItem({item, searchTerm}: SearchResultItemProps) {
    return (
        <Link
            to={`/items/${item.id}`}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow block"
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
                <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                    <SearchHighlight text={item.title} highlight={searchTerm}/>
                </h3>
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                        <span className="capitalize">{item.condition.replace('_', ' ')}</span>
                        <span className="mx-1">•</span>
                        <span>{item.category.name}</span>
                    </div>
                    <span className="flex items-center">★ {item.seller.rating}</span>
                    {/* This is seller rating, we'll add item rating below if available */}
                </div>
                {/* Display Item Average Rating */}
                { (typeof item.average_item_rating === 'number' || typeof item.item_review_count === 'number') && (
                    <div className="mt-1">
                        <StarRatingDisplay rating={item.average_item_rating} count={item.item_review_count} size="text-sm" />
                    </div>
                )}
            </div>
        </Link>
    );
}

// Helper to display stars (can be moved to a shared utility if used in more places)
// Or ensure it's imported if already shared. For this task, defining it here if not imported.
const StarRatingDisplay = ({ rating, count, size = 'text-md' }: { rating?: number; count?: number; size?: string }) => {
    // Ensure rating is valid, default to 0 if not for calculation if count exists
    const displayRating = (typeof rating === 'number' && rating >= 0 && rating <= 5) ? rating : 0;
    const displayCount = typeof count === 'number' ? count : 0;

    if (displayCount === 0 && displayRating === 0) {
        return <span className={`text-xs text-gray-400 ${size === 'text-sm' ? 'mt-0.5' : ''}`}>No reviews yet</span>;
    }
    // If there's a rating but no count, or count is 0 but rating > 0 (unusual), still show stars for rating.
    // If count > 0 but rating is 0, it means reviews exist but all are 0-star (or data issue), show stars.

    const fullStars = Math.floor(displayRating);
    const halfStar = displayRating % 1 >= 0.5 ? 1 : 0; // Simplified half star logic
    const emptyStars = 5 - fullStars - halfStar;

    return (
        <div className="flex items-center">
            {[...Array(fullStars)].map((_, i) => <span key={`full-${i}`} className={`text-yellow-400 ${size}`}>★</span>)}
            {halfStar === 1 && <span key="half" className={`text-yellow-400 ${size}`}>★</span>} {/* Simplification: showing full for half */}
            {[...Array(emptyStars)].map((_, i) => <span key={`empty-${i}`} className={`text-gray-300 ${size}`}>★</span>)}
            {displayCount > 0 && <span className="ml-1 text-xs text-gray-500">({displayCount})</span>}
        </div>
    );
};