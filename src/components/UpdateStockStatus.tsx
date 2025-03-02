// src/components/UpdateStockStatus.tsx
import React, { useState } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StockStatus } from './StockStatus';

interface UpdateStockStatusProps {
  itemId: string;
  currentStatus: string;
  onUpdate?: (newStatus: string) => void;
  isSeller: boolean;
}

export function UpdateStockStatus({
  itemId,
  currentStatus,
  onUpdate,
  isSeller
}: UpdateStockStatusProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If not the seller, just show the status
  if (!isSeller) {
    return <StockStatus status={currentStatus} />;
  }

  async function handleUpdateStatus(newStatus: string) {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .rpc('update_item_stock_status', {
          item_id: itemId,
          new_stock_status: newStatus
        });

      if (error) throw error;

      setStatus(newStatus);
      if (onUpdate) onUpdate(newStatus);
    } catch (error) {
      console.error('Error updating stock status:', error);
      setError('Failed to update stock status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Package size={18} />
        <span className="font-medium">Stock Status:</span>
        <StockStatus status={status} />
      </div>

      {error && (
        <div className="text-red-600 text-sm flex items-center gap-1">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleUpdateStatus('in_stock')}
          disabled={loading || status === 'in_stock'}
          className={`px-3 py-1 text-sm rounded-full ${
            status === 'in_stock' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          In Stock
        </button>
        <button
          onClick={() => handleUpdateStatus('low_stock')}
          disabled={loading || status === 'low_stock'}
          className={`px-3 py-1 text-sm rounded-full ${
            status === 'low_stock' 
              ? 'bg-amber-100 text-amber-800' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          Low Stock
        </button>
        <button
          onClick={() => handleUpdateStatus('out_of_stock')}
          disabled={loading || status === 'out_of_stock'}
          className={`px-3 py-1 text-sm rounded-full ${
            status === 'out_of_stock' 
              ? 'bg-red-100 text-red-800' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          Out of Stock
        </button>
      </div>
    </div>
  );
}