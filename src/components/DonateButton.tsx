import {useEffect, useState} from 'react';
import {Gift} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {supabase} from '../lib/supabase';

interface DonateButtonProps {
    itemId: string;
}

export function DonateButton({itemId}: DonateButtonProps) {
    const {user} = useAuth();
    const [orgs, setOrgs] = useState<any[]>([]);
    const [selectedOrg, setSelectedOrg] = useState('');
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        checkDonationStatus();
        fetchOrgs();
    }, [itemId, user]);

    async function checkDonationStatus() {
        const {data} = await supabase
            .from('items')
            .select('donation_status')
            .eq('id', itemId)
            .single();
        setIsPending(data?.donation_status === 'pending');
    }

    async function fetchOrgs() {
        const {data} = await supabase.rpc('get_donation_organizations');
        setOrgs(data || []);
    }

    async function handleDonate() {
        if (!selectedOrg) return;
        try {
            const {error} = await supabase.rpc('request_item_donation', {
                item_id: itemId,
                org_id: selectedOrg,
            });
            if (error) throw error;
            setIsPending(true);
            alert('Donation request submitted!');
        } catch (error) {
            console.error('Error requesting donation:', error);
        }
    }

    if (!user || isPending) {
        return (
            <button
                disabled
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2"
            >
                <Gift size={18}/>
                {isPending ? 'Donation Pending' : 'Donate'}
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="p-2 border rounded"
            >
                <option value="">Select Organization</option>
                {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                        {org.name}
                    </option>
                ))}
            </select>
            <button
                onClick={handleDonate}
                disabled={!selectedOrg}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
                <Gift size={18}/>
                Donate
            </button>
        </div>
    );
}