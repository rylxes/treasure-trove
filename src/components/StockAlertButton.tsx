// src/components/StockAlertButton.tsx
import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface StockAlertButtonProps {
  itemId: string;
  stockStatus: string;
  size?: number;
  showText?: boolean;
  className?: string;
}

export function StockAlertButton({
  itemId,
  stockStatus,
  size = 20,
  showText = true,
  className = ''
}: StockAlertButtonProps) {
  const { user } = useAuth();
  const [hasAlert, setHasAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      checkAlertStatus();
    }
  }, [user, itemId]);

  async function checkAlertStatus() {
    try {
      const { data, error } = await supabase
        .rpc('has_stock_alert', { item_id: itemId });

      if (error) throw error;
      setHasAlert(data || false);
    } catch (error) {
      console.error('Error checking stock alert status:', error);
    }
  }

  async function handleToggleAlert() {
    if (!user) {
      // Redirect to auth page if not logged in
      window.location.href = '/auth';
      return;
    }

    if (hasAlert) {
      // If alert already exists, remove it
      await removeStockAlert();
    } else {
      // Show modal to set alert preferences
      setShowModal(true);
    }
  }

  async function removeStockAlert() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('toggle_stock_alert', { item_id: itemId });

      if (error) throw error;
      setHasAlert(false);
    } catch (error) {
      console.error('Error removing stock alert:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createStockAlert() {
    setLoading(true);
    setError('');
    try {
      // Create alert
      const { data, error } = await supabase
        .rpc('toggle_stock_alert', {
          item_id: itemId,
          notify_email: notifyEmail,
          notify_push: notifyPush
        });

      if (error) throw error;

      setHasAlert(true);
      setShowModal(false);
    } catch (error) {
      console.error('Error creating stock alert:', error);
      setError('Failed to create stock alert. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Only show for out-of-stock items
  if (stockStatus !== 'out_of_stock') {
    return null;
  }

  const buttonClasses = `${className} flex items-center gap-2 ${
    hasAlert 
      ? 'text-orange-600 hover:text-orange-500' 
      : 'text-gray-600 hover:text-gray-500'
  }`;

  if (!user) {
    return (
      <button
        onClick={() => window.location.href = '/auth'}
        className={buttonClasses}
        aria-label="Notify Me When Available"
      >
        <Bell size={size} />
        {showText && <span>Notify When Available</span>}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleToggleAlert}
        disabled={loading}
        className={buttonClasses}
        aria-label={hasAlert ? "Remove Stock Alert" : "Notify Me When Available"}
      >
        <Bell size={size} fill={hasAlert ? 'currentColor' : 'none'} />
        {showText && (
          <span>{hasAlert ? 'Alert Set' : 'Notify When Available'}</span>
        )}
      </button>

      {/* Stock Alert Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Back in Stock Alert</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 flex items-center gap-2">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-gray-600">
                We'll notify you when this item is back in stock. Choose how you'd like to be notified:
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Email</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifyPush}
                      onChange={(e) => setNotifyPush(e.target.checked)}
                      className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Push notifications</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createStockAlert}
                  disabled={loading || (!notifyEmail && !notifyPush)}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? 'Setting...' : 'Set Alert'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}