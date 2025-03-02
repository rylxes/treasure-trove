// src/components/Collections.tsx
import React, {useState, useEffect} from 'react';
import {Bookmark} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {createCollection, getUserCollections} from '../lib/supabase';

export function Collections() {
    const {user} = useAuth();
    const [collections, setCollections] = useState<any[]>([]);
    const [newCollection, setNewCollection] = useState({
        name: '',
        description: '',
        isPublic: false
    });

    useEffect(() => {
        if (user) fetchCollections();
    }, [user]);

    async function fetchCollections() {
        try {
            const data = await getUserCollections();
            setCollections(data);
        } catch (error) {
            console.error('Error fetching collections:', error);
        }
    }

    async function handleCreateCollection() {
        if (!user) return; // Ensure user is authenticated
        try {
            await createCollection(user.id, newCollection.name, newCollection.description, newCollection.isPublic);
            setNewCollection({name: '', description: '', isPublic: false});
            fetchCollections();
        } catch (error) {
            console.error('Error creating collection:', error);
        }
    }

    if (!user) return null;

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Your Collections</h2>

            {/* New Collection Form */}
            <div className="mb-6 flex gap-4">
                <input
                    type="text"
                    placeholder="Collection name"
                    value={newCollection.name}
                    onChange={e => setNewCollection({...newCollection, name: e.target.value})}
                    className="flex-1 p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Description"
                    value={newCollection.description}
                    onChange={e => setNewCollection({
                        ...newCollection,
                        description: e.target.value
                    })}
                    className="flex-1 p-2 border rounded"
                />
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={newCollection.isPublic}
                        onChange={e => setNewCollection({
                            ...newCollection,
                            isPublic: e.target.checked
                        })}
                    />
                    Public
                </label>
                <button
                    onClick={handleCreateCollection}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
                >
                    Create
                </button>
            </div>

            {/* Collections List */}
            <div className="space-y-4">
                {collections.map(collection => (
                    <div key={collection.id} className="border-b pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Bookmark size={18}/>
                            <h3 className="font-semibold">{collection.name}</h3>
                            {collection.is_public &&
                              <span className="text-xs text-gray-500">(Public)</span>}
                        </div>
                        <p className="text-sm text-gray-600">{collection.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                            {collection.collection_items.map((ci: any) => (
                                <a
                                    key={ci.items.id}
                                    href={`/items/${ci.items.id}`}
                                    className="bg-gray-50 rounded p-2"
                                >
                                    <img
                                        src={ci.items.images[0] || 'https://via.placeholder.com/150'}
                                        alt={ci.items.title}
                                        className="w-full h-24 object-cover rounded"
                                    />
                                    <p className="text-sm truncate">{ci.items.title}</p>
                                    <p className="text-xs text-indigo-600">${ci.items.price}</p>
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}