// src/pages/Settings.tsx
import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {Loader2, Upload} from 'lucide-react';
import {SavedSearches} from '../components/SavedSearches'; // New import

interface Profile {
    username: string;
    full_name: string;
    bio: string;
    avatar_url: string;
    // Verification fields
    is_seller?: boolean; // Assuming this might exist or be useful contextually
    is_verified_seller?: boolean;
    verification_status?: string;
    verification_documents?: any; // JSONB can be any type
    verification_submitted_at?: string | null;
    verification_processed_at?: string | null;
    verification_admin_notes?: string | null;
}

export function Settings() {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [avatar, setAvatar] = useState<File | null>(null);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [formData, setFormData] = useState<Profile>({
        username: '',
        full_name: '',
        bio: '',
        avatar_url: '',
        // Initialize verification fields
        is_verified_seller: false,
        verification_status: 'not_requested',
        verification_documents: null,
        verification_submitted_at: null,
        verification_processed_at: null,
        verification_admin_notes: null,
    });
    const [error, setError] = useState(''); // For general profile update errors

    // State for verification application form
    const [documentInfo, setDocumentInfo] = useState<string>('');
    const [isSubmittingVerification, setIsSubmittingVerification] = useState<boolean>(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);


    useEffect(() => {
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchProfile();
    }, [user]);

    async function fetchProfile() {
        if (!user) return; // Ensure user is available
        setLoading(true);
        try {
            const {data, error: fetchError} = await supabase
                .from('profiles')
                .select(`
                    username,
                    full_name,
                    bio,
                    avatar_url,
                    is_verified_seller,
                    verification_status,
                    verification_documents,
                    verification_submitted_at,
                    verification_processed_at,
                    verification_admin_notes
                `)
                .eq('id', user.id)
                .single();

            if (fetchError) throw fetchError;

            setFormData({
                ...formData, // Keep existing form data not directly from profile select (like if more fields were added client-side)
                username: data.username || '',
                full_name: data.full_name || '',
                bio: data.bio || '',
                avatar_url: data.avatar_url || '',
                is_verified_seller: data.is_verified_seller || false,
                verification_status: data.verification_status || 'not_requested',
                verification_documents: data.verification_documents,
                verification_submitted_at: data.verification_submitted_at,
                verification_processed_at: data.verification_processed_at,
                verification_admin_notes: data.verification_admin_notes,
            });
            setAvatarUrl(data.avatar_url || '');
        } catch (err: any) {
            console.error('Error fetching profile:', err);
            setError('Failed to load profile data. ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleRequestVerification = async () => {
      if (!user) return;
      setIsSubmittingVerification(true);
      setVerificationError(null);
      setVerificationSuccess(null);
      try {
        const documentsPayload = documentInfo.trim() ? { info: documentInfo.trim() } : null;

        const { error: rpcError } = await supabase.rpc('request_seller_verification', {
          p_documents_info: documentsPayload,
        });

        if (rpcError) throw rpcError;

        setVerificationSuccess('Verification request submitted successfully! Your application is now pending review.');
        setDocumentInfo(''); // Clear input
        // Refresh profile data to show updated status
        await fetchProfile();
      } catch (err: any) {
        console.error('Error requesting verification:', err);
        setVerificationError(err.message || 'Failed to submit verification request.');
      } finally {
        setIsSubmittingVerification(false);
      }
    };

    function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            setAvatar(file);
            setAvatarUrl(URL.createObjectURL(file));
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;

        try {
            setSaving(true);
            setError('');

            let avatarUrl = formData.avatar_url;

            // Upload new avatar if selected
            if (avatar) {
                const fileExt = avatar.name.split('.').pop();
                const fileName = `${user.id}.${fileExt}`;
                const filePath = `avatars/${fileName}`;

                const {error: uploadError} = await supabase.storage
                    .from('items')
                    .upload(filePath, avatar, {upsert: true});

                if (uploadError) throw uploadError;

                const {data: {publicUrl}} = supabase.storage
                    .from('items')
                    .getPublicUrl(filePath);

                avatarUrl = publicUrl;
            }

            // Update profile
            const {error} = await supabase
                .from('profiles')
                .update({
                    ...formData,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (error) throw error;

            navigate(`/profile/${user.id}`);
        } catch (error) {
            console.error('Error updating profile:', error);
            setError('Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto"/>
                    <p className="mt-2 text-gray-600">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Profile Picture
                        </label>
                        <div className="flex items-center gap-6">
                            <div className="relative w-32 h-32">
                                <img
                                    src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${formData.username}`}
                                    alt="Profile"
                                    className="w-full h-full rounded-full object-cover"
                                />
                                <label
                                    className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50">
                                    <Upload className="w-5 h-5 text-gray-600"/>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <div className="text-sm text-gray-600">
                                <p>Upload a new profile picture</p>
                                <p>Recommended size: 400x400px</p>
                            </div>
                        </div>
                    </div>

                    {/* Username */}
                    <div>
                        <label
                            htmlFor="username"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            value={formData.username}
                            onChange={(e) =>
                                setFormData((prev) => ({...prev, username: e.target.value}))
                            }
                            className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Full Name */}
                    <div>
                        <label
                            htmlFor="fullName"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Full Name
                        </label>
                        <input
                            type="text"
                            id="fullName"
                            value={formData.full_name}
                            onChange={(e) =>
                                setFormData((prev) => ({...prev, full_name: e.target.value}))
                            }
                            className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label
                            htmlFor="bio"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Bio
                        </label>
                        <textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e) =>
                                setFormData((prev) => ({...prev, bio: e.target.value}))
                            }
                            rows={4}
                            className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Tell others about yourself..."
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/profile/${user!.id}`)}
                            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                    </div>
                </form>

                {/* Saved Searches */}
                <div className="mt-8">
                    <SavedSearches/>
                </div>

                {/* Seller Verification Section */}
                <div className="mt-10 pt-8 border-t border-gray-200">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">Seller Verification</h2>
                  {loading && !formData.verification_status && <p>Loading verification status...</p>}
                  {!loading && formData && (
                    <div>
                      <p className="mb-2 text-sm">
                        Current Status: {' '}
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-xs
                          ${formData.verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                            formData.verification_status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                            formData.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'}`}>
                          {formData.verification_status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Requested'}
                        </span>
                        {formData.is_verified_seller && formData.verification_status === 'approved' && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Verified Seller ✔</span>
                        )}
                      </p>

                      {formData.verification_status === 'pending_review' && formData.verification_submitted_at && (
                        <p className="text-xs text-gray-500 mb-1">Submitted on: {new Date(formData.verification_submitted_at).toLocaleDateString()}</p>
                      )}
                      {formData.verification_status === 'approved' && formData.verification_processed_at && (
                        <p className="text-xs text-gray-500 mb-1">Approved on: {new Date(formData.verification_processed_at).toLocaleDateString()}</p>
                      )}
                      {formData.verification_status === 'rejected' && (
                        <>
                          {formData.verification_processed_at && <p className="text-xs text-gray-500 mb-1">Reviewed on: {new Date(formData.verification_processed_at).toLocaleDateString()}</p>}
                          {formData.verification_admin_notes && <p className="text-sm text-red-600 mt-1 p-2 bg-red-50 rounded-md">Admin Notes: {formData.verification_admin_notes}</p>}
                        </>
                      )}
                       {formData.verification_status === 'needs_more_info' && (
                        <>
                          {formData.verification_processed_at && <p className="text-xs text-gray-500 mb-1">Reviewed on: {new Date(formData.verification_processed_at).toLocaleDateString()}</p>}
                          {formData.verification_admin_notes && <p className="text-sm text-yellow-600 mt-1 p-2 bg-yellow-50 rounded-md">Admin Notes: {formData.verification_admin_notes}</p>}
                        </>
                      )}


                      {formData.verification_documents && (formData.verification_status === 'pending_review' || formData.verification_status === 'approved' || formData.verification_status === 'needs_more_info') && (
                        <div className="mt-3 text-sm">
                          <p className="font-medium text-gray-700">Submitted Information:</p>
                          <pre className="bg-gray-100 p-3 rounded-md text-xs whitespace-pre-wrap overflow-x-auto text-gray-600">
                            {typeof formData.verification_documents === 'string'
                              ? formData.verification_documents
                              : JSON.stringify(formData.verification_documents, null, 2)}
                          </pre>
                        </div>
                      )}

                      {(formData.verification_status === 'not_requested' || formData.verification_status === 'rejected' || formData.verification_status === 'needs_more_info') && (
                        <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <h3 className="text-md font-semibold mb-2 text-gray-700">
                            {formData.verification_status === 'rejected' ? 'Re-apply for Verification' :
                             formData.verification_status === 'needs_more_info' ? 'Provide More Information & Re-apply' :
                             'Apply for Verification'}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Verified sellers build more trust. If you have supporting documents (e.g., business registration, ID for identity check), please provide details or links.
                          </p>
                          <textarea
                            rows={4}
                            placeholder="Example: Business ID: 12345. Proof of address: [link to utility bill]. Social media: [link to profile]."
                            value={documentInfo}
                            onChange={(e) => setDocumentInfo(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm mb-3"
                          />
                          <button
                            onClick={handleRequestVerification}
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                            disabled={isSubmittingVerification}
                          >
                            {isSubmittingVerification ? (
                                <>
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                                </>
                            ) : 'Submit Verification Request'}
                          </button>
                          {verificationError && <p className="text-red-500 text-sm mt-2">{verificationError}</p>}
                          {verificationSuccess && <p className="text-green-500 text-sm mt-2">{verificationSuccess}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

            </div>
        </div>
    );
}