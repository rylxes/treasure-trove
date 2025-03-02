import { supabase } from './supabase';

export async function getCurrency() {
  const { data } = await supabase.rpc('get_default_currency');
  return data || { code: 'USD', symbol: '$' };
}

export function formatPrice(price: number, symbol: string) {
  return `${symbol}${price.toFixed(2)}`;
}