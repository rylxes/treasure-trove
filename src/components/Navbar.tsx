// src/components/Navbar.tsx with wishlist integration
import React from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {
    Bell,
    BellRing,
    MessageSquare,
    PlusCircle,
    Search,
    Settings,
    Shield,
    User
} from 'lucide-react';
import {WishlistCount} from './WishlistCount'; // Import the new component

export function Navbar() {
    const {user, signOut} = useAuth();
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [showDropdown, setShowDropdown] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (user) {
            checkAdminStatus();
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function checkAdminStatus() {
        try {
            const {data: profile, error} = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user!.id)
                .single();

            if (error) throw error;
            setIsAdmin(profile?.role === 'admin' || profile?.role === 'super_admin');
        } catch (error) {
            console.error('Error checking admin status:', error);
            setIsAdmin(false);
        }
    }

    return (
        <nav className="bg-white shadow-lg">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-indigo-600">Treasure Trove</span>
                    </Link>

                    <div className="flex items-center space-x-4">
                        <Link to="/browse" className="text-gray-700 hover:text-indigo-600">
                            Browse
                        </Link>

                        {user ? (
                            <>
                                <Link
                                    to="/create-listing"
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-1"
                                >
                                    <PlusCircle size={18}/>
                                    <span>Sell Item</span>
                                </Link>

                                <Link to="/notifications"
                                      className="text-gray-700 hover:text-indigo-600">
                                    <Bell size={20}/>
                                </Link>

                                <Link to="/messages"
                                      className="text-gray-700 hover:text-indigo-600">
                                    <MessageSquare size={20}/>
                                </Link>

                                {/* Add Wishlist Icon with Count */}
                                <WishlistCount/>

                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setShowDropdown(!showDropdown)}
                                        className="flex items-center space-x-1 text-gray-700 hover:text-indigo-600 focus:outline-none"
                                    >
                                        <User size={20}/>
                                    </button>

                                    {showDropdown && (
                                        <div
                                            className="absolute right-0 w-48 mt-2 py-2 bg-white rounded-lg shadow-xl z-50">
                                            <Link
                                                to={`/profile/${user.id}`}
                                                onClick={() => setShowDropdown(false)}
                                                className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                Profile
                                            </Link>
                                            <Link
                                                to="/wishlist"
                                                onClick={() => setShowDropdown(false)}
                                                className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                My Wishlist
                                            </Link>
                                            <Link
                                                to="/price-alerts"
                                                onClick={() => setShowDropdown(false)}
                                                className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <BellRing size={16}/>
                                                    Price Alerts
                                                </div>
                                            </Link>
                                            <Link
                                                to="/stock-alerts"
                                                onClick={() => setShowDropdown(false)}
                                                className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Bell size={16}/>
                                                    Back in Stock Alerts
                                                </div>
                                            </Link>
                                            <Link
                                                to="/saved-search-alerts"
                                                onClick={() => setShowDropdown(false)}
                                                className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Search size={16}/>
                                                    Saved Searches
                                                </div>
                                            </Link>
                                            <Link
                                                to="/settings"
                                                onClick={() => setShowDropdown(false)}
                                                className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Settings size={16}/>
                                                    Settings
                                                </div>
                                            </Link>
                                            {isAdmin && (
                                                <Link
                                                    to="/admin"
                                                    onClick={() => setShowDropdown(false)}
                                                    className="block px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Shield size={16}/>
                                                        Admin Panel
                                                    </div>
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => {
                                                    signOut();
                                                    setShowDropdown(false);
                                                }}
                                                className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-indigo-50"
                                            >
                                                Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <Link
                                to="/auth"
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}