// src/components/PriceAlertButton.tsx
import {useEffect, useState} from 'react';
import {AlertTriangle, BellRing, X} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';

interface PriceAlertButtonProps {
    itemId: string;
    price: number;
    size?: number;
    showText?: boolean;
    className?: string;
}

export function PriceAlertButton({
                                     itemId,
                                     price,
                                     size = 20,
                                     showText = true,
                                     className = ''
                                 }: PriceAlertButtonProps) {
    const {user} = useAuth();
    const [hasAlert, setHasAlert] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [targetPrice, setTargetPrice] = useState('');
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
            const {data, error} = await supabase
                .rpc('has_price_alert', {item_id: itemId});

            if (error) throw error;
            setHasAlert(data || false);
        } catch (error) {
            console.error('Error checking price alert status:', error);
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
            await removePriceAlert();
        } else {
            // Show modal to set alert preferences
            setShowModal(true);
            // Set default target price to 10% below current price
            setTargetPrice((price * 0.9).toFixed(2));
        }
    }

    async function removePriceAlert() {
        setLoading(true);
        try {
            const {data, error} = await supabase
                .rpc('toggle_price_alert', {item_id: itemId});

            if (error) throw error;
            setHasAlert(false);
        } catch (error) {
            console.error('Error removing price alert:', error);
        } finally {
            setLoading(false);
        }
    }

    async function createPriceAlert() {
        setLoading(true);
        setError('');
        try {
            // Validate target price
            const targetPriceNum = parseFloat(targetPrice);
            if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
                setError('Please enter a valid target price');
                setLoading(false);
                return;
            }

            // Create alert
            const {data, error} = await supabase
                .rpc('toggle_price_alert', {
                    item_id: itemId,
                    target_price: targetPriceNum,
                    notify_email: notifyEmail,
                    notify_push: notifyPush
                });

            if (error) throw error;

            setHasAlert(true);
            setShowModal(false);
        } catch (error) {
            console.error('Error creating price alert:', error);
            setError('Failed to create price alert. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const buttonClasses = `${className} flex items-center gap-2 ${
        hasAlert
            ? 'text-purple-600 hover:text-purple-500'
            : 'text-gray-600 hover:text-gray-500'
    }`;

    if (!user) {
        return (
            <button
                onClick={() => window.location.href = '/auth'}
                className={buttonClasses}
                aria-label="Price Alert"
            >
                <BellRing size={size}/>
                {showText && <span>Price Alert</span>}
            </button>
        );
    }

    return (
        <>
            <button
                onClick={handleToggleAlert}
                disabled={loading}
                className={buttonClasses}
                aria-label={hasAlert ? "Remove Price Alert" : "Set Price Alert"}
            >
                <BellRing size={size} fill={hasAlert ? 'currentColor' : 'none'}/>
                {showText && (
                    <span>{hasAlert ? 'Alert Set' : 'Price Alert'}</span>
                )}
            </button>

            {/* Price Alert Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Set Price Alert</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {error && (
                            <div
                                className="bg-red-50 text-red-600 p-3 rounded-md mb-4 flex items-center gap-2">
                                <AlertTriangle size={18}/>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Current Price: ${price}
                                </label>
                                <div className="flex items-center gap-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Alert me when price is
                                    </label>
                                    <div className="relative flex-1">
                                        <span
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                            type="number"
                                            value={targetPrice}
                                            onChange={(e) => setTargetPrice(e.target.value)}
                                            className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            step="0.01"
                                            min="0.01"
                                        />
                                    </div>
                                    <span className="text-sm text-gray-500">or less</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Notification Preferences
                                </label>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={notifyEmail}
                                            onChange={(e) => setNotifyEmail(e.target.checked)}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">Email</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={notifyPush}
                                            onChange={(e) => setNotifyPush(e.target.checked)}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                        />
                                        <span
                                            className="text-sm text-gray-700">Push notifications</span>
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
                                    onClick={createPriceAlert}
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
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