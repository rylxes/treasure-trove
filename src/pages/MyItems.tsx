import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom'; // Import Link for navigation
import {ShareListing} from '../components/ShareListing';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';
import {ShoppingBag, Tag} from 'lucide-react';

export function MyItems() {
    const {user} = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [tab, setTab] = useState<'offered' | 'bought'>('offered');

    useEffect(() => {
        if (user) fetchItems();
    }, [user, tab]);

    async function fetchItems() {
        const {data} = await supabase.rpc('get_user_items');
        setItems(data?.filter((item: any) => item.type === tab) || []);
    }

    if (!user) return <div>Please log in to view your items.</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">My Items</h1>
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setTab('offered')}
                    className={`px-4 py-2 rounded-lg ${tab === 'offered' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                >
                    <Tag size={18} className="inline mr-2"/>
                    Offered for Sale
                </button>
                <button
                    onClick={() => setTab('bought')}
                    className={`px-4 py-2 rounded-lg ${tab === 'bought' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                >
                    <ShoppingBag size={18} className="inline mr-2"/>
                    Bought
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        to={`/items/${item.id}`} // Navigate to item details page
                        className="bg-white rounded-lg shadow-md p-4 block hover:shadow-lg transition-shadow"
                    >
                        <img
                            src={item.images[0] || 'https://via.placeholder.com/150'}
                            alt={item.title}
                            className="w-full h-48 object-cover rounded"
                        />
                        <h3 className="font-semibold mt-2">{item.title}</h3>
                        <p className="text-indigo-600">${item.price}</p>
                        <p className="text-sm text-gray-600">Status: {item.stock_status || 'Unknown'}</p>
                        {tab === 'offered' && (
                            <div
                                onClick={(e) => e.preventDefault()} // Prevent Link navigation when clicking Share
                                className="mt-2"
                            >
                                <ShareListing
                                    itemId={item.id}
                                    title={item.title}
                                    platforms={['twitter', 'facebook']}
                                />
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}