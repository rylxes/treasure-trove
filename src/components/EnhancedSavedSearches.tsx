// src/components/EnhancedSavedSearches.tsx
import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {AlertCircle, Bell, Search, Trash2} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';

export function EnhancedSavedSearches() {
    const {user} = useAuth();
    const [searches, setSearches] = useState<any[]>([]);
    const [newSearch, setNewSearch] = useState({
        name: '',
        query: '',
        notifyEmail: false,
        notifyPush: false,
        alertEnabled: false
    });
    const [currentSearch, setCurrentSearch] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuggestion, setShowSuggestion] = useState(false);

    useEffect(() => {
        if (user) fetchSearches();
    }, [user]);

    useEffect(() => {
        // Get current search from URL
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('query') || '';
        const category = urlParams.get('category') || '';
        const minPrice = urlParams.get('minPrice') || '';
        const maxPrice = urlParams.get('maxPrice') || '';
        const condition = urlParams.get('condition') || '';

        // Build a search string representation
        let searchDescription = [];
        if (query) searchDescription.push(`"${query}"`);
        if (category) searchDescription.push(`in ${category}`);
        if (minPrice && maxPrice) {
            searchDescription.push(`$${minPrice}-$${maxPrice}`);
        } else if (minPrice) {
            searchDescription.push(`min $${minPrice}`);
        } else if (maxPrice) {
            searchDescription.push(`max $${maxPrice}`);
        }
        if (condition) searchDescription.push(condition.replace('_', ' '));

        // Set the current search if any filters are applied
        const currentSearchStr = searchDescription.join(', ');
        if (currentSearchStr) {
            setCurrentSearch(currentSearchStr);

            // Show save suggestion if this looks like a new search
            const searchExists = searches.some(s => s.query === query &&
                s.filters?.category === category &&
                s.filters?.minPrice === minPrice &&
                s.filters?.maxPrice === maxPrice &&
                s.filters?.condition === condition);

            setShowSuggestion(!searchExists && (query || category || minPrice || maxPrice || condition));

            // Pre-populate the new search form
            if (!searchExists) {
                setNewSearch({
                    name: query ? `Search for ${query}` : `${category || 'All items'} search`,
                    query: query,
                    notifyEmail: false,
                    notifyPush: false,
                    alertEnabled: false
                });
            }
        } else {
            setShowSuggestion(false);
        }
    }, [window.location.search, searches]);

    async function fetchSearches() {
        try {
            const {data, error} = await supabase.rpc('get_saved_searches_with_alerts');
            if (error) throw error;
            setSearches(data || []);
        } catch (error) {
            console.error('Error fetching saved searches:', error);
        }
    }

    async function handleSaveSearch() {
        if (!user) return;
        setLoading(true);
        setError('');

        try {
            // Get current search filters from URL
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('query') || '';
            const category = urlParams.get('category') || '';
            const minPrice = urlParams.get('minPrice') || '';
            const maxPrice = urlParams.get('maxPrice') || '';
            const condition = urlParams.get('condition') || '';

            // Create filters object
            const filters = {
                category: category,
                minPrice: minPrice,
                maxPrice: maxPrice,
                condition: condition
            };

            // Save the search
            const {error} = await supabase
                .from('saved_searches')
                .insert({
                    user_id: user.id,
                    name: newSearch.name,
                    query: query,
                    filters: filters,
                    notify_email: newSearch.notifyEmail,
                    notify_push: newSearch.notifyPush,
                    alert_enabled: newSearch.alertEnabled,
                    alert_frequency: 'daily'
                });

            if (error) throw error;

            // Reset form and refresh searches
            setNewSearch({
                name: '',
                query: '',
                notifyEmail: false,
                notifyPush: false,
                alertEnabled: false
            });
            setShowSuggestion(false);
            fetchSearches();
        } catch (error) {
            console.error('Error saving search:', error);
            setError('Failed to save search. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteSearch(id: string) {
        try {
            const {error} = await supabase
                .from('saved_searches')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSearches();
        } catch (error) {
            console.error('Error deleting search:', error);
        }
    }

    if (!user) return null;

    return (
        <div className="space-y-6">
            {/* Current Search Save Suggestion */}
            {showSuggestion && (
                <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={20} className="text-indigo-600"/>
                            <h3 className="font-semibold">Save Your Current Search</h3>
                        </div>
                    </div>

                    <p className="text-gray-600 mb-3">
                        Save <span className="font-medium">{currentSearch}</span> to easily run it
                        again or get alerts about new matching items.
                    </p>

                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Search name"
                            value={newSearch.name}
                            onChange={e => setNewSearch({...newSearch, name: e.target.value})}
                            className="w-full p-2 border rounded-lg"
                        />

                        <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-1">
                                <input
                                    type="checkbox"
                                    checked={newSearch.alertEnabled}
                                    onChange={e => setNewSearch({
                                        ...newSearch,
                                        alertEnabled: e.target.checked
                                    })}
                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <span
                                    className="text-sm text-gray-700">Enable alerts for new items</span>
                            </label>

                            {newSearch.alertEnabled && (
                                <>
                                    <label className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={newSearch.notifyEmail}
                                            onChange={e => setNewSearch({
                                                ...newSearch,
                                                notifyEmail: e.target.checked
                                            })}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">Email</span>
                                    </label>
                                    <label className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={newSearch.notifyPush}
                                            onChange={e => setNewSearch({
                                                ...newSearch,
                                                notifyPush: e.target.checked
                                            })}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">Push</span>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm mt-2">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => setShowSuggestion(false)}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveSearch}
                            disabled={loading || !newSearch.name}
                            className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Search'}
                        </button>
                    </div>
                </div>
            )}

            {/* Saved Searches List */}
            {searches.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Your Saved Searches</h3>
                        <Link
                            to="/saved-search-alerts"
                            className="text-indigo-600 text-sm hover:text-indigo-700"
                        >
                            View All ({searches.length})
                        </Link>
                    </div>

                    <div className="divide-y">
                        {searches.slice(0, 3).map((search) => (
                            <div key={search.id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Search size={16} className="text-indigo-600"/>
                                    <span>{search.name}</span>
                                    {search.alert_enabled && (
                                        <Bell size={12} className="text-indigo-600"/>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        to={`/browse?query=${encodeURIComponent(search.query || '')}`}
                                        className="text-indigo-600 hover:text-indigo-700"
                                    >
                                        Run
                                    </Link>
                                    <button
                                        onClick={() => handleDeleteSearch(search.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}