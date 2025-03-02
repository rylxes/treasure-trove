import {useEffect, useState} from 'react';
import {DollarSign} from 'lucide-react';
import {supabase} from '../../lib/supabase';

export function CurrencyManager() {
    const [currency, setCurrency] = useState({code: 'USD', symbol: '$'});
    const currencies = [
        {code: 'USD', symbol: '$'},
        {code: 'EUR', symbol: '€'},
        {code: 'GBP', symbol: '£'},
    ];

    useEffect(() => {
        fetchCurrency();
    }, []);

    async function fetchCurrency() {
        const {data} = await supabase.rpc('get_default_currency');
        if (data) setCurrency(data);
    }

    async function handleSaveCurrency() {
        try {
            await supabase.rpc('set_default_currency', {
                currency_code: currency.code,
                currency_symbol: currency.symbol,
            });
            alert('Currency updated!');
        } catch (error) {
            console.error('Error updating currency:', error);
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Currency Management</h2>
            <div className="flex gap-4 items-center">
                <DollarSign size={20}/>
                <select
                    value={currency.code}
                    onChange={(e) => {
                        const selected = currencies.find(c => c.code === e.target.value);
                        if (selected) setCurrency(selected);
                    }}
                    className="p-2 border rounded"
                >
                    {currencies.map(c => (
                        <option key={c.code} value={c.code}>
                            {c.code} ({c.symbol})
                        </option>
                    ))}
                </select>
                <button
                    onClick={handleSaveCurrency}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
                >
                    Save
                </button>
            </div>
        </div>
    );
}