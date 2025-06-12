import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {ImageIcon, Upload, X} from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  username: string;
}

export function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    condition: '',
    category_id: '',
    selling_method: 'fixed',
    location: '',
    ends_at: '' // Added for auction end date
  });

  // Helper function to get current local datetime string for min attribute
  const getMinDateTimeLocal = () => {
    const now = new Date();
    // Adjust for timezone offset to get local time
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localNow.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCategories();
    } else {
      navigate('/auth');
    }
  }, [user]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // If no profile exists, create one
      if ((error as any).code === 'PGRST116') {
        await createProfile();
      }
    }
  }

  async function createProfile() {
    try {
      const username = `user_${Math.random().toString(36).slice(2, 10)}`;
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user!.id,
          username,
          full_name: '',
          is_seller: true
        })
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error creating profile:', error);
      navigate('/auth');
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 5 - images.length;
    const newImages = [...images, ...files.slice(0, remainingSlots)];
    setImages(newImages);

    // Create preview URLs
    const newImageUrls = newImages.map(file => URL.createObjectURL(file));
    setImageUrls(newImageUrls);
  }

  function removeImage(index: number) {
    const newImages = images.filter((_, i) => i !== index);
    const newImageUrls = imageUrls.filter((_, i) => i !== index);
    
    // Revoke the old URL to prevent memory leaks
    URL.revokeObjectURL(imageUrls[index]);
    
    setImages(newImages);
    setImageUrls(newImageUrls);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;

    try {
      setLoading(true);

      // Upload images to storage
      const uploadedImageUrls = await Promise.all(
        images.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `items/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('items')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('items')
            .getPublicUrl(filePath);

          return publicUrl;
        })
      );

      // Create item
      const itemPayload: any = {
        ...formData,
        price: parseFloat(formData.price),
        seller_id: user.id,
        images: uploadedImageUrls,
        is_active: true,
        // Ensure ends_at is null if not an auction, or properly formatted ISO string if it is
        ends_at: formData.selling_method === 'auction' && formData.ends_at
                 ? new Date(formData.ends_at).toISOString()
                 : null,
      };

      // Basic validation for auction end date
      if (formData.selling_method === 'auction' && (!formData.ends_at || new Date(formData.ends_at) <= new Date())) {
        alert('For auctions, please specify a future end date and time.');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('items')
        .insert(itemPayload);

      if (insertError) throw insertError;

      navigate('/profile/' + user.id);
    } catch (error) {
      console.error('Error creating listing:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Create New Listing</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images (up to 5)
            </label>
            <div className="grid grid-cols-5 gap-4">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 5 - imageUrls.length) }).map((_, index) => (
                <label
                  key={`empty-${index}`}
                  className={`aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors ${
                    index === 0 && imageUrls.length === 0
                      ? 'border-indigo-500'
                      : 'border-gray-300'
                  }`}
                >
                  {index === 0 && imageUrls.length === 0 ? (
                    <>
                      <ImageIcon className="w-8 h-8 text-indigo-500 mb-2" />
                      <span className="text-sm text-indigo-600 text-center px-2">
                        Add main photo
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-xs text-gray-500 mt-1">Add photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              First image will be the main photo. Add up to 5 photos.
            </p>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={4}
              className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Price and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="price"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {formData.selling_method === 'auction' ? 'Starting Price' : 'Price'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  id="price"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  className="w-full pl-8 rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Category
              </label>
              <select
                id="category"
                value={formData.category_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, category_id: e.target.value }))
                }
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Condition and Selling Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="condition"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Condition
              </label>
              <select
                id="condition"
                value={formData.condition}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, condition: e.target.value }))
                }
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select condition</option>
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="selling_method"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Selling Method
              </label>
              <select
                id="selling_method"
                value={formData.selling_method}
                onChange={(e) => {
                  const newSellingMethod = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    selling_method: newSellingMethod,
                    // Reset ends_at if switching away from auction
                    ends_at: newSellingMethod !== 'auction' ? '' : prev.ends_at
                  }));
                }}
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="fixed">Fixed Price</option>
                <option value="negotiation">Accept Offers</option>
                <option value="auction">Auction</option>
              </select>
            </div>
          </div>

          {/* Auction End Date - Conditional */}
          {formData.selling_method === 'auction' && (
            <div>
              <label
                htmlFor="ends_at"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Auction End Date & Time
              </label>
              <input
                type="datetime-local"
                id="ends_at"
                name="ends_at" // Ensure name matches formData key for direct update if using spread for setFormData
                value={formData.ends_at}
                onChange={(e) => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                min={getMinDateTimeLocal()}
                className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required={formData.selling_method === 'auction'} // Required only if auction
              />
              {formData.ends_at && new Date(formData.ends_at) <= new Date() && (
                 <p className="text-xs text-red-500 mt-1">End date must be in the future.</p>
              )}
            </div>
          )}

          {/* Location */}
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Location
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location: e.target.value }))
              }
              className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || images.length === 0}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Listing...' : 'Create Listing'}
          </button>
        </form>
      </div>
    </div>
  );
}