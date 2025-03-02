// src/pages/PriceAlerts.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Loader, AlertTriangle, ArrowDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PriceAlert {
  id: string;
  item_id: string;
  title: string;
  current_price: number;
  target_price: number | null;
  images: string[];
  created_at: string;
  notify_email: boolean;
  notify_push: boolean;
}

export function PriceAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchPriceAlerts();
  }, [user]);

  async function fetchPriceAlerts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_price_alerts');

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      setError('Failed to load price alerts. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveAlert(alertId: string) {
    try {
      // Get the item_id from the alert to toggle
      const alert = alerts.find(a => a.id === alertId);
      if (!alert) return;

      const { error } = await supabase
        .rpc('toggle_price_alert', { item_id: alert.item_id });

      if (error) throw error;

      // Remove the alert from the state
      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Error removing price alert:', error);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader size={40} className="animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading your price alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchPriceAlerts}
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
          <BellRing className="text-purple-500" />
          Price Alerts
        </h1>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-lg text-center">
          <BellRing size={64} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold mb-2">No price alerts set</h2>
          <p className="text-gray-600 mb-6">Get notified when items you're interested in drop in price</p>
          <Link
            to="/browse"
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Browse Items
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative">
                <button
                  onClick={() => handleRemoveAlert(alert.id)}
                  className="absolute top-2 right-2 bg-white bg-opacity-70 hover:bg-opacity-100 p-1 rounded-full z-10"
                  aria-label="Remove alert"
                >
                  <X size={18} className="text-gray-500" />
                </button>
                <Link to={`/items/${alert.item_id}`} className="block">
                  <div className="aspect-square relative">
                    <img
                      src={alert.images[0] || 'https://via.placeholder.com/400'}
                      alt={alert.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Link>
              </div>
              <div className="p-4">
                <Link to={`/items/${alert.item_id}`} className="block">
                  <h3 className="font-semibold text-lg mb-1 truncate">{alert.title}</h3>
                </Link>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-lg font-medium">${alert.current_price}</div>
                  {alert.target_price && (
                    <div className="flex items-center gap-1 text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                      <ArrowDown size={12} />
                      <span>Alert at ${alert.target_price}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div>
                    Created {new Date(alert.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1">
                    {alert.notify_email && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">Email</span>
                    )}
                    {alert.notify_push && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">Push</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}