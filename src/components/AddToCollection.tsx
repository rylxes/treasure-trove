// src/components/AddToCollection.tsx
import React, {useState, useEffect} from 'react';
import {Plus} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {addToCollection, getUserCollections} from '../lib/supabase';


interface AddToCollectionProps {
    itemId: string;
}

export function AddToCollection({itemId}: AddToCollectionProps) {
    const {user} = useAuth();
    const [collections, setCollections] = useState<any[]>([]);
    const [selectedCollection, setSelectedCollection] = useState('');

    useEffect(() => {
        if (user) fetchCollections();
    }, [user]);

    async function fetchCollections() {
        const data = await getUserCollections();
        setCollections(data);
    }

    async function handleAdd() {
        if (!selectedCollection) return;
        try {
            await addToCollection(selectedCollection, itemId);
            alert('Added to collection!');
        } catch (error) {
            console.error('Error adding to collection:', error);
        }
    }

    if (!user) return null;

    return (
        <div className="flex items-center gap-2">
            <select
                value={selectedCollection}
                onChange={e => setSelectedCollection(e.target.value)}
                className="p-2 border rounded"
            >
                <option value="">Select Collection</option>
                {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <button
                onClick={handleAdd}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
            >
                <Plus size={18}/>
            </button>
        </div>
    );
}