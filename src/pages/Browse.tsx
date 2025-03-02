// src/pages/Browse.tsx
import React, {useCallback, useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Loader, Search, SlidersHorizontal, X} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {SearchItem, searchItems, SearchParams} from '../lib/elasticsearch';
import {debounce} from 'lodash';
import {EnhancedSavedSearches} from '../components/EnhancedSavedSearches';

interface Category {
    id: string;
    name: string;
    slug: string;
}

export function Browse() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [items, setItems] = useState<SearchItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [searchTime, setSearchTime] = useState(0);

    // Extract filters from URL parameters
    const [filters, setFilters] = useState<SearchParams>({
        query: searchParams.get('query') || '',
        category: searchParams.get('category') || '',
        minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
        maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
        condition: searchParams.get('condition') || '',
        sort: (searchParams.get('sort') || 'newest') as 'newest' | 'price-asc' | 'price-desc',
        limit: 20,
        offset: 0
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (categories.length > 0) {
            performSearch();
        }
    }, [filters, categories]);

    // Create debounced search function
    const debouncedSearch = useCallback(
        debounce(() => {
            performSearch();
        }, 300),
        [filters]
    );

    // Handle search input change with debounce
    const handleSearchInputChange = (value: string) => {
        setFilters(prev => ({...prev, query: value, offset: 0}));
        debouncedSearch();
        updateSearchParams('query', value);
    };

    async function fetchCategories() {
        try {
            const {data, error} = await supabase
                .from('categories')
                .select('id, name, slug')
                .order('name');

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    async function performSearch() {
        try {
            setLoading(true);

            // Call Elasticsearch service
            const response = await searchItems(filters);

            setItems(response.items);
            setTotalItems(response.total);
            setSearchTime(response.took);
        } catch (error) {
            console.error('Error searching items:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleFilterChange(key: keyof SearchParams, value: any) {
        setFilters(prev => ({...prev, [key]: value, offset: 0}));
        updateSearchParams(key, value?.toString() || '');
    }

    function updateSearchParams(key: string, value: string) {
        setSearchParams(prev => {
            if (value) {
                prev.set(key, value);
            } else {
                prev.delete(key);
            }
            return prev;
        });
    }

    function handleLoadMore() {
        setFilters(prev => ({
            ...prev,
            offset: prev.offset! + prev.limit!
        }));
    }

    function resetFilters() {
        setFilters({
            query: '',
            category: '',
            minPrice: undefined,
            maxPrice: undefined,
            condition: '',
            sort: 'newest',
            limit: 20,
            offset: 0
        });
        setSearchParams({});
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Search and Filter Header */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input
                        type="text"
                        placeholder="Search items..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={filters.query}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                    />
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                    <SlidersHorizontal size={20}/>
                    Filters
                </button>
            </div>

            {/* Search stats */}
            {totalItems > 0 && (
                <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                    <span>Found {totalItems} items in {searchTime}ms</span>
                    {items.length > 0 && items[0].hasOwnProperty('searchMode') && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
              Search mode: {(items as any)[0].searchMode === 'elasticsearch' ? 'Elasticsearch' : 'Database'}
            </span>
                    )}
                </div>
            )}

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Category
                            </label>
                            <select
                                value={filters.category}
                                onChange={(e) => handleFilterChange('category', e.target.value)}
                                className="w-full border rounded-lg p-2"
                            >
                                <option value="">All Categories</option>
                                {categories.map(category => (
                                    <option key={category.id} value={category.slug}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Price Range
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minPrice || ''}
                                    onChange={(e) => handleFilterChange('minPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-full border rounded-lg p-2"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={filters.maxPrice || ''}
                                    onChange={(e) => handleFilterChange('maxPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-full border rounded-lg p-2"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Condition
                            </label>
                            <select
                                value={filters.condition}
                                onChange={(e) => handleFilterChange('condition', e.target.value)}
                                className="w-full border rounded-lg p-2"
                            >
                                <option value="">Any Condition</option>
                                <option value="new">New</option>
                                <option value="like_new">Like New</option>
                                <option value="good">Good</option>
                                <option value="fair">Fair</option>
                                <option value="poor">Poor</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sort By
                            </label>
                            <select
                                value={filters.sort}
                                onChange={(e) => handleFilterChange('sort', e.target.value as any)}
                                className="w-full border rounded-lg p-2"
                            >
                                <option value="newest">Newest First</option>
                                <option value="price-asc">Price: Low to High</option>
                                <option value="price-desc">Price: High to Low</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end mt-4">
                        <button
                            onClick={resetFilters}
                            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                        >
                            <X size={16}/>
                            Clear Filters
                        </button>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <EnhancedSavedSearches/>
            </div>

            {/* Items Grid */}
            {loading && items.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({length: 8}).map((_, i) => (
                        <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="aspect-square bg-gray-200 animate-pulse"/>
                            <div className="p-4">
                                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"/>
                                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"/>
                            </div>
                        </div>
                    ))}
                </div>
            ) : items.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {items.map((item) => (
                            <a
                                key={item.id}
                                href={`/items/${item.id}`}
                                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
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
                                    <h3 className="font-semibold text-lg mb-1 truncate">
                                        {item.title}
                                    </h3>
                                    <div
                                        className="flex items-center justify-between text-sm text-gray-600">
                                        <span>{item.condition.replace('_', ' ')}</span>
                                        <span>★ {item.seller.rating}</span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>

                    {/* Load more button */}
                    {items.length < totalItems && (
                        <div className="text-center mt-8">
                            <button
                                onClick={handleLoadMore}
                                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader size={16} className="animate-spin"/>
                                        Loading...
                                    </>
                                ) : (
                                    <>Load More</>
                                )}
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-12">
                    <p className="text-gray-600">No items found matching your criteria.</p>
                </div>
            )}
        </div>
    );
}