// src/components/ShareListing.tsx
import React from 'react';
import {Facebook, Share2, Twitter} from 'lucide-react';

interface ShareListingProps {
  itemId: string;
  title: string;
}

export function ShareListing({ itemId, title }: ShareListingProps) {
  const shareUrl = `${window.location.origin}/items/${itemId}`;
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
  };

  function handleShare(platform: 'twitter' | 'facebook') {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400');
  }

  return (
    <div className="flex items-center gap-2">
      <Share2 size={18} className="text-gray-600" />
      <span className="text-sm text-gray-600 mr-2">Share:</span>
      <button
        onClick={() => handleShare('twitter')}
        className="p-1 hover:text-indigo-600"
        aria-label="Share on Twitter"
      >
        <Twitter size={18} />
      </button>
      <button
        onClick={() => handleShare('facebook')}
        className="p-1 hover:text-indigo-600"
        aria-label="Share on Facebook"
      >
        <Facebook size={18} />
      </button>
    </div>
  );
}