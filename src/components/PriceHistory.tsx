// src/components/PriceHistory.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowDown, ArrowUp, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

interface PriceHistoryProps {
  itemId: string;
  currentPrice: number;
}

interface PriceChange {
  id: string;
  old_price: number;
  new_price: number;
  changed_at: string;
}

interface ChartData {
  date: string;
  price: number;
  formattedDate: string;
}

export function PriceHistory({ itemId, currentPrice }: PriceHistoryProps) {
  const [priceHistory, setPriceHistory] = useState<PriceChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [highestPrice, setHighestPrice] = useState(currentPrice);
  const [lowestPrice, setLowestPrice] = useState(currentPrice);

  useEffect(() => {
    fetchPriceHistory();
  }, [itemId]);

  useEffect(() => {
    if (priceHistory.length > 0) {
      prepareChartData();
    }
  }, [priceHistory, currentPrice]);

  async function fetchPriceHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('item_id', itemId)
        .order('changed_at', { ascending: true });

      if (error) throw error;
      setPriceHistory(data || []);
    } catch (error) {
      console.error('Error fetching price history:', error);
    } finally {
      setLoading(false);
    }
  }

  function prepareChartData() {
    // If there's price history data, prepare it for the chart
    if (priceHistory.length > 0) {
      // Start with the initial price (the "old_price" of the first change)
      let chartPoints: ChartData[] = [
        {
          date: priceHistory[0].changed_at,
          price: priceHistory[0].old_price,
          formattedDate: format(parseISO(priceHistory[0].changed_at), 'MMM d, yyyy')
        }
      ];

      // Add all the price change points
      priceHistory.forEach(change => {
        chartPoints.push({
          date: change.changed_at,
          price: change.new_price,
          formattedDate: format(parseISO(change.changed_at), 'MMM d, yyyy')
        });
      });

      // Add the current price as the last point if it's different from the last change
      if (priceHistory.length > 0 && priceHistory[priceHistory.length - 1].new_price !== currentPrice) {
        chartPoints.push({
          date: new Date().toISOString(),
          price: currentPrice,
          formattedDate: 'Now'
        });
      }

      // Find highest and lowest prices
      const prices = chartPoints.map(point => point.price);
      setHighestPrice(Math.max(...prices));
      setLowestPrice(Math.min(...prices));

      setChartData(chartPoints);
    } else {
      // If no price history, just show the current price
      setChartData([
        {
          date: new Date().toISOString(),
          price: currentPrice,
          formattedDate: 'Now'
        }
      ]);
    }
  }

  const priceChange = priceHistory.length > 0
    ? currentPrice - priceHistory[0].old_price
    : 0;

  const percentChange = priceHistory.length > 0
    ? ((currentPrice - priceHistory[0].old_price) / priceHistory[0].old_price) * 100
    : 0;

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <TrendingDown size={18} />
          Price History
        </h3>
        {priceHistory.length > 0 && (
          <button
            onClick={() => setShowChart(!showChart)}
            className="text-indigo-600 text-sm hover:text-indigo-700"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        )}
      </div>

      {priceHistory.length === 0 ? (
        <div className="text-sm text-gray-500 mt-2">
          No price changes recorded yet
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm">
              <div className="text-gray-500">Initial Price</div>
              <div className="font-medium">${priceHistory[0].old_price.toFixed(2)}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-500">Highest Price</div>
              <div className="font-medium">${highestPrice.toFixed(2)}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-500">Lowest Price</div>
              <div className="font-medium">${lowestPrice.toFixed(2)}</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-500">Current Price</div>
              <div className="font-medium">${currentPrice.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className={`text-sm font-medium ${
              priceChange < 0 ? 'text-green-600' : priceChange > 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {priceChange < 0 ? (
                <span className="flex items-center gap-1">
                  <ArrowDown size={14} />
                  ${Math.abs(priceChange).toFixed(2)} ({Math.abs(percentChange).toFixed(1)}%)
                </span>
              ) : priceChange > 0 ? (
                <span className="flex items-center gap-1">
                  <ArrowUp size={14} />
                  ${priceChange.toFixed(2)} ({percentChange.toFixed(1)}%)
                </span>
              ) : (
                <span>No change</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              since {format(parseISO(priceHistory[0].changed_at), 'MMM d, yyyy')}
            </div>
          </div>

          {showChart && chartData.length > 1 && (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'MM/dd')}
                    scale="time"
                    type="category"
                  />
                  <YAxis
                    domain={[Math.floor(lowestPrice * 0.9), Math.ceil(highestPrice * 1.1)]}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    labelFormatter={(label) => {
                      const point = chartData.find(data => data.date === label);
                      return point ? point.formattedDate : '';
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#6366F1"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}