// src/components/AIRecommendations.tsx
import React, {useEffect, useState} from 'react';
import {
    getPersonalizedRecommendations,
    getPopularRecommendations,
    RecommendationItem
} from '../lib/recommendations';
import {ChevronLeft, ChevronRight, Sparkles} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {formatPrice, getCurrency} from '../lib/currency';

interface AIRecommendationsProps {
    type?: 'personalized' | 'popular';
    limit?: number;
    title?: string;
}

export function AIRecommendations({
                                      type = 'personalized',
                                      limit = 10,
                                      title
                                  }: AIRecommendationsProps) {
    const {user} = useAuth();
    const [items, setItems] = useState<RecommendationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [currency, setCurrency] = useState({code: 'USD', symbol: '$'});
    useEffect(() => {
        getCurrency().then(setCurrency);
    }, []);
    // Set default title based on type
    const defaultTitle = type === 'personalized'
        ? 'Recommended for You'
        : 'Popular Items';

    const displayTitle = title || defaultTitle;

    useEffect(() => {
        fetchRecommendations();

        // Add resize listener to update scroll capabilities
        const handleResize = () => {
            if (containerRef.current && contentRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
                setContentWidth(contentRef.current.scrollWidth);
            }
        };

        window.addEventListener('resize', handleResize);

        // Call once to initialize
        setTimeout(handleResize, 100);

        return () => window.removeEventListener('resize', handleResize);
    }, [type, user]);

    async function fetchRecommendations() {
        try {
            setLoading(true);

            // Get recommendations based on type
            let data: RecommendationItem[];

            if (type === 'personalized' && user) {
                data = await getPersonalizedRecommendations(limit);
            } else {
                data = await getPopularRecommendations(limit);
            }

            setItems(data);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleScroll(direction: 'left' | 'right') {
        if (!containerRef.current) return;

        const containerWidth = containerRef.current.clientWidth;
        const scrollAmount = containerWidth * 0.8; // Scroll 80% of container width

        let newPosition = direction === 'left'
            ? Math.max(0, scrollPosition - scrollAmount)
            : Math.min(contentWidth - containerWidth, scrollPosition + scrollAmount);

        setScrollPosition(newPosition);

        if (containerRef.current) {
            containerRef.current.scrollTo({
                left: newPosition,
                behavior: 'smooth'
            });
        }
    }

    if (loading) {
        return (
            <div className="my-8">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={18} className="text-indigo-600"/>
                    <h3 className="text-xl font-semibold">{displayTitle}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                    {Array.from({length: 4}).map((_, i) => (
                        <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="aspect-square bg-gray-200 animate-pulse"/>
                            <div className="p-3">
                                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"/>
                                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"/>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return null; // Don't show anything if no recommendations
    }

    const canScrollLeft = scrollPosition > 0;
    const canScrollRight = containerWidth && contentWidth ? scrollPosition < contentWidth - containerWidth : false;

    return (
        <div className="my-8">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-600"/>
                    <h3 className="text-xl font-semibold">{displayTitle}</h3>
                </div>

                {/* Scroll controls */}
                {(canScrollLeft || canScrollRight) && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleScroll('left')}
                            disabled={!canScrollLeft}
                            className="p-1 rounded-full border disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20}/>
                        </button>
                        <button
                            onClick={() => handleScroll('right')}
                            disabled={!canScrollRight}
                            className="p-1 rounded-full border disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                )}
            </div>

            {/* Scrollable container */}
            <div
                className="overflow-x-auto scrollbar-hide pb-4"
                ref={containerRef}
                onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
            >
                <div
                    className="flex gap-4"
                    ref={contentRef}
                    style={{width: 'max-content'}}
                >
                    {items.map((item) => (
                        <a
                            key={item.id}
                            href={`/items/${item.id}`}
                            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow w-44 md:w-56 flex-shrink-0"
                        >
                            <div className="aspect-square relative">
                                <img
                                    src={item.images[0] || 'https://via.placeholder.com/400'}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                />
                                <div
                                    className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-sm font-medium">
                                    {formatPrice(item.price, currency.symbol)}
                                </div>
                                {type === 'personalized' && (
                                    <div
                                        className="absolute bottom-2 left-2 bg-indigo-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                                        <Sparkles size={12}/>
                                        For You
                                    </div>
                                )}
                            </div>
                            <div className="p-3">
                                <h4 className="font-medium text-sm mb-1 truncate">
                                    {item.title}
                                </h4>
                                <div
                                    className="flex justify-between items-center text-xs text-gray-600">
                                    <span>{item.condition.replace('_', ' ')}</span>
                                    {item.recommendation_score && (
                                        <span className="text-indigo-600 font-medium">
                      {Math.round(item.recommendation_score * 100)}% match
                    </span>
                                    )}
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}