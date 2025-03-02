// src/components/SavedSearches.tsx
import React, {useState, useEffect} from 'react';
import {Search, Bell, Trash2} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {saveSearch, getSavedSearches, deleteSavedSearch} from '../lib/supabase';

export function SavedSearches() {
    const {user} = useAuth();
    const [searches, setSearches] = useState<any[]>([]);
    const [newSearch, setNewSearch] = useState({
        name: '',
        query: '',
        notifyEmail: false,
        notifyPush: false
    });

    useEffect(() => {
        if (user) fetchSearches();
    }, [user]);

    async function fetchSearches() {
        try {
            const data = await getSavedSearches();
            setSearches(data);
        } catch (error) {
            console.error('Error fetching saved searches:', error);
        }
    }

    async function handleSaveSearch() {
        if (!user) return; // Ensure user is authenticated
        try {
            await saveSearch(user.id, { // Pass user.id
                name: newSearch.name,
                query: newSearch.query,
                filters: {},
                notifyEmail: newSearch.notifyEmail,
                notifyPush: newSearch.notifyPush,
            });
            setNewSearch({name: '', query: '', notifyEmail: false, notifyPush: false});
            fetchSearches();
        } catch (error) {
            console.error('Error saving search:', error);
        }
    }

    async function handleDeleteSearch(id: string) {
        try {
            await deleteSavedSearch(id);
            fetchSearches();
        } catch (error) {
            console.error('Error deleting search:', error);
        }
    }

    if (!user) return null;

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Saved Searches</h2>

            {/* New Search Form */}
            <div className="mb-6 flex gap-4">
                <input
                    type="text"
                    placeholder="Search name"
                    value={newSearch.name}
                    onChange={e => setNewSearch({...newSearch, name: e.target.value})}
                    className="flex-1 p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Search query"
                    value={newSearch.query}
                    onChange={e => setNewSearch({...newSearch, query: e.target.value})}
                    className="flex-1 p-2 border rounded"
                />
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={newSearch.notifyEmail}
                        onChange={e => setNewSearch({...newSearch, notifyEmail: e.target.checked})}
                    />
                    Email
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={newSearch.notifyPush}
                        onChange={e => setNewSearch({...newSearch, notifyPush: e.target.checked})}
                    />
                    Push
                </label>
                <button
                    onClick={handleSaveSearch}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
                >
                    Save
                </button>
            </div>

            {/* Saved Searches List */}
            <div className="space-y-4">
                {searches.map(search => (
                    <div key={search.id}
                         className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                            <Search size={16}/>
                            <span>{search.name}: "{search.query}"</span>
                            {(search.notify_email || search.notify_push) && (
                                <Bell size={16} className="text-indigo-600"/>
                            )}
                        </div>
                        <button
                            onClick={() => handleDeleteSearch(search.id)}
                            className="text-red-600 hover:text-red-800"
                        >
                            <Trash2 size={16}/>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}