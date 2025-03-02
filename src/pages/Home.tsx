// src/pages/Home.tsx
import React from 'react';
import {Link} from 'react-router-dom';
import {Search, Tag, ShieldCheck, TrendingUp} from 'lucide-react';
import {AIRecommendations} from '../components/AIRecommendations';
import {RecentlyViewedItems} from '../components/RecentlyViewedItems';
import {useAuth} from '../contexts/AuthContext';

export function Home() {
    const {user} = useAuth();

    const featuredCategories = [
        {
            name: 'Furniture',
            image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600'
        },
        {
            name: 'Electronics',
            image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=600'
        },
        {
            name: 'Home Decor',
            image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=600'
        },
        {
            name: 'Kitchen',
            image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&q=80&w=600'
        }
    ];

    return (
        <div className="space-y-16">
            {/* Hero Section */}
            <section className="relative h-[500px] flex items-center">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1529720317453-c8da503f2051?auto=format&fit=crop&q=80&w=2000"
                        alt="Treasure Trove Hero"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50"/>
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="max-w-2xl text-white">
                        <h1 className="text-5xl font-bold mb-6">
                            Discover Unique Treasures for Your Home
                        </h1>
                        <p className="text-xl mb-8">
                            Buy and sell pre-loved items in your community. Find great deals or
                            give your items a second life.
                        </p>
                        <div className="flex gap-4">
                            <Link
                                to="/browse"
                                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
                            >
                                Start Browsing
                            </Link>
                            <Link
                                to="/create-listing"
                                className="bg-white text-indigo-600 px-6 py-3 rounded-lg hover:bg-gray-100 transition"
                            >
                                Sell an Item
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Personalized Recommendations (only for logged in users) */}
            {user && (
                <section className="container mx-auto px-4">
                    <AIRecommendations type="personalized" limit={12}/>
                </section>
            )}

            {/* Recently Viewed Items (only for logged in users) */}
            {user && (
                <section className="container mx-auto px-4">
                    <RecentlyViewedItems limit={8}/>
                </section>
            )}

            {/* Features Section */}
            <section className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="text-center">
                        <div
                            className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-indigo-600"/>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Easy to Browse</h3>
                        <p className="text-gray-600">
                            Find exactly what you're looking for with our powerful search and filter
                            system.
                        </p>
                    </div>

                    <div className="text-center">
                        <div
                            className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Tag className="w-8 h-8 text-indigo-600"/>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Great Deals</h3>
                        <p className="text-gray-600">
                            Get the best prices on quality pre-loved items from trusted sellers.
                        </p>
                    </div>

                    <div className="text-center">
                        <div
                            className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="w-8 h-8 text-indigo-600"/>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Secure Transactions</h3>
                        <p className="text-gray-600">
                            Shop with confidence using our secure payment and escrow system.
                        </p>
                    </div>
                </div>
            </section>

            {/* Featured Categories */}
            <section className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold">Featured Categories</h2>
                    <Link to="/browse" className="text-indigo-600 hover:text-indigo-700">
                        View All Categories →
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {featuredCategories.map((category) => (
                        <Link
                            key={category.name}
                            to={`/browse?category=${category.name.toLowerCase()}`}
                            className="group relative h-64 overflow-hidden rounded-lg"
                        >
                            <img
                                src={category.image}
                                alt={category.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                            <div
                                className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
                            <h3 className="absolute bottom-4 left-4 text-xl font-semibold text-white">
                                {category.name}
                            </h3>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Popular Items Section */}
            <section className="container mx-auto px-4 pb-16">
                <AIRecommendations type="popular" limit={12} title="Trending Now"/>
            </section>
        </div>
    );
}