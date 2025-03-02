// src/components/admin/ElasticsearchStatus.tsx
import React, {useEffect, useState} from 'react';
import {
  checkElasticsearchStatus,
  ElasticsearchStatus as StatusType,
  testElasticsearchConnection
} from '../../lib/elasticsearch';
import {AlertTriangle, CheckCircle, Database, RefreshCw, XCircle} from 'lucide-react';

export function ElasticsearchStatus() {
  const [status, setStatus] = useState<StatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      setLoading(true);
      const result = await checkElasticsearchStatus();
      setStatus(result);
    } catch (error) {
      console.error('Error fetching Elasticsearch status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      const result = await testElasticsearchConnection();
      setStatus(result);
    } catch (error) {
      console.error('Error testing Elasticsearch connection:', error);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
        <div className="animate-spin">
          <RefreshCw size={20} />
        </div>
        <div>Checking Elasticsearch status...</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
        <AlertTriangle size={20} className="text-yellow-500" />
        <div className="flex-1">Unable to determine Elasticsearch status</div>
        <button
          onClick={fetchStatus}
          className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  const isAvailable = status.available;
  const isConfigured = status.configured;

  return (
    <div className={`border p-4 rounded-lg shadow ${
      isAvailable 
        ? 'bg-green-50 border-green-200' 
        : isConfigured
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database size={20} className={isAvailable ? 'text-green-500' : 'text-gray-400'} />
          <h3 className="font-medium">Elasticsearch Status</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 rounded-full hover:bg-white/50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="font-medium">Status:</div>
          <div className="flex items-center gap-1">
            {isAvailable ? (
              <>
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-green-700">Available</span>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-red-500" />
                <span className="text-red-700">Unavailable</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="font-medium">Search Mode:</div>
          <div className="px-2 py-0.5 rounded bg-white/50 text-sm">
            {isAvailable ? 'Elasticsearch' : 'Database Fallback'}
          </div>
        </div>

        {status.url && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">URL:</span> {status.url}
          </div>
        )}

        {status.index && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Index:</span> {status.index}
          </div>
        )}

        {status.lastSync && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Last Sync:</span> {new Date(status.lastSync).toLocaleString()}
          </div>
        )}

        {status.error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100 mt-2">
            <span className="font-medium">Error:</span> {status.error}
          </div>
        )}

        {!isConfigured && (
          <div className="text-sm bg-blue-50 p-2 rounded border border-blue-100 mt-2">
            <span className="font-medium">Info:</span> Elasticsearch is not configured.
            The application will use optimized database queries for search functionality.
          </div>
        )}
      </div>
    </div>
  );
}