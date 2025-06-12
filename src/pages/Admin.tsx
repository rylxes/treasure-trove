// src/pages/Admin.tsx
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';
import {AlertTriangle, Search, Shield, UserMinus, UserPlus} from 'lucide-react';
import {SearchRecommendationsControls} from '../components/admin/SearchRecommendationsControls';
import {CategoryManager} from '../components/admin/CategoryManager';
import {DonationManager} from "../components/admin/DonationManager.tsx";
import {CurrencyManager} from "../components/admin/CurrencyManager.tsx"; // New import

interface AdminUser {
    id: string;
    username: string;
    full_name: string;
    email: string;
    role: string;
    created_at: string;
}

interface AdminLog {
    id: string;
    admin: {
        username: string;
    };
    action: string;
    details: any;
    created_at: string;
}

export function Admin() {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'tools'>('users');

    useEffect(() => {
        checkAdminStatus();
    }, [user]);

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
            fetchLogs();
        }
    }, [isAdmin]);

    async function checkAdminStatus() {
        if (!user) {
            navigate('/auth');
            return;
        }

        try {
            const {data: profile, error} = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
            const isSuperAdmin = profile.role === 'super_admin';

            setIsAdmin(isAdmin);
            setIsSuperAdmin(isSuperAdmin);

            if (!isAdmin) {
                navigate('/');
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            navigate('/');
        }
    }

    async function fetchUsers() {
        try {
            setError('');

            // Get all profiles
            const {data: profiles, error: profilesError} = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', {ascending: false});

            if (profilesError) throw profilesError;

            // Get auth users data using the secure function
            const {data: authUsers, error: authError} = await supabase
                .rpc('get_auth_users');

            if (authError) throw authError;

            // Combine the data
            const usersWithEmail = profiles?.map(profile => {
                const authUser = authUsers?.find(user => user.id === profile.id);
                return {
                    ...profile,
                    email: authUser?.email || 'N/A',
                };
            });

            setUsers(usersWithEmail || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }

    async function fetchLogs() {
        try {
            const {data, error} = await supabase
                .from('admin_logs')
                .select(`
          id,
          admin:profiles!admin_logs_admin_id_fkey(username),
          action,
          details,
          created_at
        `)
                .order('created_at', {ascending: false})
                .limit(50);

            if (error) throw error;
            setLogs(data);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    }

    async function handlePromoteToAdmin(userId: string) {
        try {
            setError('');
            const {error} = await supabase.rpc('promote_to_admin', {
                user_id: userId,
            });

            if (error) throw error;
            fetchUsers();
            fetchLogs();
        } catch (error) {
            console.error('Error promoting user:', error);
            setError('Failed to promote user to admin');
        }
    }

    async function handleRevokeAdmin(userId: string) {
        try {
            setError('');
            const {error} = await supabase.rpc('revoke_admin', {
                user_id: userId,
            });

            if (error) throw error;
            fetchUsers();
            fetchLogs();
        } catch (error) {
            console.error('Error revoking admin:', error);
            setError('Failed to revoke admin privileges');
        }
    }

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"/>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-200 rounded"/>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Shield className="text-indigo-600"/>
                    Admin Dashboard
                </h1>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <AlertTriangle size={20}/>
                    {error}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-lg ${
                        activeTab === 'users'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    User Management
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 rounded-lg ${
                        activeTab === 'logs'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Admin Logs
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`px-4 py-2 rounded-lg ${
                        activeTab === 'tools'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    Admin Tools
                </button>
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <>
                    {/* Search */}
                    <div className="mb-6">
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Joined
                                </th>
                                {isSuperAdmin && (
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img
                                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`}
                                                alt={user.username}
                                                className="w-8 h-8 rounded-full"
                                            />
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {user.username}
                                                </div>
                                                {user.full_name && (
                                                    <div className="text-sm text-gray-500">
                                                        {user.full_name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.role === 'super_admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : user.role === 'admin'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {user.role}
                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    {isSuperAdmin && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {user.role === 'user' ? (
                                                <button
                                                    onClick={() => handlePromoteToAdmin(user.id)}
                                                    className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 ml-auto"
                                                >
                                                    <UserPlus size={16}/>
                                                    Make Admin
                                                </button>
                                            ) : user.role === 'admin' ? (
                                                <button
                                                    onClick={() => handleRevokeAdmin(user.id)}
                                                    className="text-red-600 hover:text-red-900 flex items-center gap-1 ml-auto"
                                                >
                                                    <UserMinus size={16}/>
                                                    Revoke Admin
                                                </button>
                                            ) : null}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Admin Logs Tab */}
            {activeTab === 'logs' && (
                <>
                    <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="flow-root">
                            <ul className="divide-y divide-gray-200">
                                {logs.map((log) => (
                                    <li key={log.id} className="p-4 hover:bg-gray-50">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex-shrink-0">
                                                <img
                                                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${log.admin.username}`}
                                                    alt={log.admin.username}
                                                    className="w-8 h-8 rounded-full"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {log.admin.username}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {log.action.replace(/_/g, ' ')} -
                                                    {JSON.stringify(log.details)}
                                                </p>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </>
            )}

            {/* Admin Tools Tab */}
            {activeTab === 'tools' && (
                <>
                    <h2 className="text-2xl font-bold mb-4">Admin Tools</h2>

                    {/* Search & Recommendations Tools */}
                    <SearchRecommendationsControls/>

                    {/* Category Manager */}
                    <div className="mt-8">
                        <CategoryManager/>
                    </div>


                    <div className="mt-8">
                        <DonationManager/>
                    </div>


                    <div className="mt-8">
                        <CurrencyManager/>
                    </div>


                    {/* Additional tools can be added here */}
                    <div className="bg-white rounded-lg shadow p-6 mt-8">
                        <h3 className="text-xl font-semibold mb-4">More Tools Coming Soon</h3>
                        <p className="text-gray-600">
                            Additional admin tools will be added in future updates. Stay tuned!
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}