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
                </div>
            </div>
        </Link>
    );
}