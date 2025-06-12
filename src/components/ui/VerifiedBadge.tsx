// src/components/ui/VerifiedBadge.tsx
import React from 'react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg'; // Optional size prop
  className?: string; // Allow additional classes
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 'md', className = '' }) => {
  let sizeClasses = 'w-4 h-4'; // Default medium
  if (size === 'sm') sizeClasses = 'w-3 h-3';
  if (size === 'lg') sizeClasses = 'w-5 h-5';

  return (
    <span
      className={`inline-flex items-center justify-center ml-1 ${className}`}
      title="Verified Seller"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`text-blue-500 ${sizeClasses}`}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.469 6.469a.75.75 0 01.023 1.06L11.25 13.5l-2.22-2.22a.75.75 0 011.06-1.06l1.168 1.167 2.472-2.472a.75.75 0 011.037-.023z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
};

export default VerifiedBadge;
