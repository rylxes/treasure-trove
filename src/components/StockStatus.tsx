// src/components/StockStatus.tsx
import React from 'react';
import {AlertTriangle, CheckCircle, XCircle} from 'lucide-react';

interface StockStatusProps {
  status: string;
  className?: string;
}

export function StockStatus({ status, className = '' }: StockStatusProps) {
  let statusDisplay = {
    icon: <CheckCircle size={16} />,
    text: 'In Stock',
    color: 'text-green-600 bg-green-50',
  };

  if (status === 'low_stock') {
    statusDisplay = {
      icon: <AlertTriangle size={16} />,
      text: 'Low Stock',
      color: 'text-amber-600 bg-amber-50',
    };
  } else if (status === 'out_of_stock') {
    statusDisplay = {
      icon: <XCircle size={16} />,
      text: 'Out of Stock',
      color: 'text-red-600 bg-red-50',
    };
  }

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${statusDisplay.color} ${className}`}>
      {statusDisplay.icon}
      <span>{statusDisplay.text}</span>
    </div>
  );
}