import {useEffect, useState} from 'react';
import {Edit, Gift, Trash2} from 'lucide-react';
import {supabase} from '../../lib/supabase';

export function DonationManager() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [newOrg, setNewOrg] = useState({name: '', description: '', contact: ''});
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchOrgs();
    }, []);

    async function fetchOrgs() {
        const {data} = await supabase.from('donation_organizations').select('*');
        setOrgs(data || []);
    }

    async function handleSaveOrg() {
        const contactInfo = {email: newOrg.contact};
        try {
            if (editingId) {
                await supabase
                    .from('donation_organizations')
                    .update({
                        name: newOrg.name,
                        description: newOrg.description,
                        contact_info: contactInfo
                    })
                    .eq('id', editingId);
                setEditingId(null);
            } else {
                await supabase
                    .from('donation_organizations')
                    .insert({
                        name: newOrg.name,
                        description: newOrg.description,
                        contact_info: contactInfo
                    });
            }
            setNewOrg({name: '', description: '', contact: ''});
            fetchOrgs();
        } catch (error) {
            console.error('Error saving organization:', error);
        }
    }

    async function handleDeleteOrg(id: string) {
        await supabase.from('donation_organizations').delete().eq('id', id);
        fetchOrgs();
    }

    function startEditing(org: any) {
        setEditingId(org.id);
        setNewOrg({
            name: org.name,
            description: org.description,
            contact: org.contact_info?.email || '',
        });
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Donation Organizations</h2>
            <div className="mb-6 flex gap-4">
                <input
                    type="text"
                    placeholder="Name"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                    className="flex-1 p-2 border rounded"
                />
                <input
                    type="text"
                    placeholder="Description"
                    value={newOrg.description}
                    onChange={(e) => setNewOrg({...newOrg, description: e.target.value})}
                    className="flex-1 p-2 border rounded"
                />
                <input
                    type="email"
                    placeholder="Contact Email"
                    value={newOrg.contact}
                    onChange={(e) => setNewOrg({...newOrg, contact: e.target.value})}
                    className="flex-1 p-2 border rounded"
                />
                <button
                    onClick={handleSaveOrg}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
                >
                    {editingId ? 'Update' : 'Add'}
                </button>
            </div>
            <div className="space-y-2">
                {orgs.map((org) => (
                    <div key={org.id} className="flex items-center justify-between border-b py-2">
                        <div className="flex items-center gap-2">
                            <Gift size={16}/>
                            <span>{org.name} - {org.description}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => startEditing(org)} className="text-indigo-600">
                                <Edit size={16}/>
                            </button>
                            <button onClick={() => handleDeleteOrg(org.id)}
                                    className="text-red-600">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}