// src/pages/SavedSearchAlerts.tsx
import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {AlertTriangle, Bell, Check, Clock, Edit, Loader, Search, X} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../contexts/AuthContext';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: any;
  notify_email: boolean;
  notify_push: boolean;
  alert_enabled: boolean;
  alert_frequency: string;
  created_at: string;
  match_count: number;
}

export function SavedSearchAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSearchId, setEditingSearchId] = useState<string | null>(null);
  const [alertSettings, setAlertSettings] = useState({
    enabled: false,
    frequency: 'daily'
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchSavedSearches();
  }, [user]);

  async function fetchSavedSearches() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_saved_searches_with_alerts');

      if (error) throw error;
      setSearches(data || []);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      setError('Failed to load saved searches. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSearch(id: string) {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSearches(searches.filter(search => search.id !== id));
    } catch (error) {
      console.error('Error deleting saved search:', error);
    }
  }

  function openAlertSettings(search: SavedSearch) {
    setEditingSearchId(search.id);
    setAlertSettings({
      enabled: search.alert_enabled,
      frequency: search.alert_frequency
    });
  }

  async function saveAlertSettings() {
    if (!editingSearchId) return;

    try {
      const { error } = await supabase
        .rpc('toggle_saved_search_alert', {
          search_id: editingSearchId,
          enable: alertSettings.enabled,
          frequency: alertSettings.frequency
        });

      if (error) throw error;

      // Update the search in the local state
      setSearches(searches.map(search => {
        if (search.id === editingSearchId) {
          return {
            ...search,
            alert_enabled: alertSettings.enabled,
            alert_frequency: alertSettings.frequency
          };
        }
        return search;
      }));

      // Close the edit panel
      setEditingSearchId(null);
    } catch (error) {
      console.error('Error updating alert settings:', error);
    }
  }

  const runSearchUrl = (search: SavedSearch) => {
    let url = `/browse?query=${encodeURIComponent(search.query)}`;

    if (search.filters) {
      if (search.filters.category) url += `&category=${encodeURIComponent(search.filters.category)}`;
      if (search.filters.minPrice) url += `&minPrice=${encodeURIComponent(search.filters.minPrice)}`;
      if (search.filters.maxPrice) url += `&maxPrice=${encodeURIComponent(search.filters.maxPrice)}`;
      if (search.filters.condition) url += `&condition=${encodeURIComponent(search.filters.condition)}`;
    }

    return url;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader size={40} className="animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading your saved searches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchSavedSearches}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Search className="text-indigo-500" />
          Saved Searches
        </h1>
        <Link
          to="/browse"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          New Search
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-lg text-center">
          <Search size={64} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold mb-2">No saved searches</h2>
          <p className="text-gray-600 mb-6">Save your favorite searches and get notified about new matching items</p>
          <Link
            to="/browse"
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Browse Items
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {searches.map((search) => (
            <div key={search.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search size={20} className="text-indigo-600" />
                  <h3 className="font-semibold text-lg">{search.name}</h3>
                  {search.alert_enabled && (
                    <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Bell size={12} />
                      Alerts {search.alert_frequency}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAlertSettings(search)}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Edit alerts"
                  >
                    <Edit size={16} className="text-gray-600" />
                  </button>
                  <Link
                    to={runSearchUrl(search)}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Run search"
                  >
                    <Search size={16} className="text-indigo-600" />
                  </Link>
                  <button
                    onClick={() => handleDeleteSearch(search.id)}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Delete search"
                  >
                    <X size={16} className="text-red-600" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-gray-700 font-medium">Query:</span>
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {search.query || 'Any'}
                  </span>

                  {search.filters?.category && (
                    <>
                      <span className="text-gray-700 font-medium">Category:</span>
                      <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {search.filters.category}
                      </span>
                    </>
                  )}

                  {(search.filters?.minPrice || search.filters?.maxPrice) && (
                    <>
                      <span className="text-gray-700 font-medium">Price:</span>
                      <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {search.filters?.minPrice ? `$${search.filters.minPrice}` : '$0'} -
                        {search.filters?.maxPrice ? `$${search.filters.maxPrice}` : 'Any'}
                      </span>
                    </>
                  )}

                  {search.filters?.condition && (
                    <>
                      <span className="text-gray-700 font-medium">Condition:</span>
                      <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {search.filters.condition.replace('_', ' ')}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-500">
                    Created {new Date(search.created_at).toLocaleDateString()}
                  </div>
                  <div className="font-medium">
                    {search.match_count} matching items
                  </div>
                </div>
              </div>

              {/* Edit Alert Settings Panel */}
              {editingSearchId === search.id && (
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Alert Settings</h4>
                    <button
                      onClick={() => setEditingSearchId(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={alertSettings.enabled}
                        onChange={(e) => setAlertSettings({...alertSettings, enabled: e.target.checked})}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="text-gray-700">Enable alerts for new matching items</span>
                    </label>

                    {alertSettings.enabled && (
                      <div className="pl-6">
                        <p className="text-sm text-gray-600 mb-2">Alert frequency:</p>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="frequency"
                              value="daily"
                              checked={alertSettings.frequency === 'daily'}
                              onChange={() => setAlertSettings({...alertSettings, frequency: 'daily'})}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="text-gray-700">Daily</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="frequency"
                              value="weekly"
                              checked={alertSettings.frequency === 'weekly'}
                              onChange={() => setAlertSettings({...alertSettings, frequency: 'weekly'})}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="text-gray-700">Weekly</span>
                          </label>
                        </div>

                        <div className="flex gap-2 items-center mt-2 text-xs text-gray-500">
                          <Clock size={14} />
                          <span>You'll receive notifications {alertSettings.frequency === 'daily' ? 'once a day' : 'once a week'}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={saveAlertSettings}
                        className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
                      >
                        <Check size={16} />
                        Save Settings
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}