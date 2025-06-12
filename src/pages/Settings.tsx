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
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchProfile();
    }, [user]);

    async function fetchProfile() {
        try {
            const {data, error} = await supabase
                .from('profiles')
                .select('username, full_name, bio, avatar_url')
                .eq('id', user!.id)
                .single();

            if (error) throw error;

            // Ensure bio is never null
            setFormData({
                ...data,
                bio: data.bio || '',
            });
            setAvatarUrl(data.avatar_url || '');
            setLoading(false);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setLoading(false);
        }
    }

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
            </div>
        </div>
    );
}