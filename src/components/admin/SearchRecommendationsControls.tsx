// src/components/admin/SearchRecommendationsControls.tsx
import React, { useState } from 'react';
import { RefreshCw, Database, Sparkles, AlertTriangle } from 'lucide-react';
import { syncElasticsearch } from '../../lib/elasticsearch';
import { updateRecommendations } from '../../lib/recommendations';
import { ElasticsearchStatus } from './ElasticsearchStatus';

export function SearchRecommendationsControls() {
  const [loading, setLoading] = useState({
    elasticsearch: false,
    recommendations: false
  });
  const [result, setResult] = useState({
    status: '' as 'success' | 'error' | '',
    message: ''
  });

  async function handleSyncElasticsearch() {
    try {
      setLoading({ ...loading, elasticsearch: true });
      setResult({ status: '', message: '' });

      const response = await syncElasticsearch();

      setResult({
        status: 'success',
        message: `Elasticsearch sync initiated successfully: ${response}`
      });
    } catch (error) {
      console.error('Error syncing Elasticsearch:', error);
      setResult({
        status: 'error',
        message: `Error syncing Elasticsearch: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading({ ...loading, elasticsearch: false });
    }
  }

  async function handleUpdateRecommendations() {
    try {
      setLoading({ ...loading, recommendations: true });
      setResult({ status: '', message: '' });

      const response = await updateRecommendations();

      setResult({
        status: 'success',
        message: `Recommendations update initiated successfully: ${response}`
      });
    } catch (error) {
      console.error('Error updating recommendations:', error);
      setResult({
        status: 'error',
        message: `Error updating recommendations: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading({ ...loading, recommendations: false });
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">Search & Recommendations</h2>

      {/* Elasticsearch Status */}
      <div className="mb-6">
        <ElasticsearchStatus />
      </div>

      {result.status && (
        <div className={`mb-4 p-4 rounded-lg ${
          result.status === 'success' 
            ? 'bg-green-50 text-green-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {result.status === 'success' ? (
              <RefreshCw size={18} className="text-green-500" />
            ) : (
              <AlertTriangle size={18} className="text-red-500" />
            )}
            <p>{result.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Database size={20} className="text-indigo-600" />
            <h3 className="text-lg font-semibold">Elasticsearch</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Sync all active items to Elasticsearch to ensure search results are up-to-date.
            This process runs automatically when items are created or updated, but a manual sync
            may be needed after system changes.
          </p>
          <button
            onClick={handleSyncElasticsearch}
            disabled={loading.elasticsearch}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full justify-center"
          >
            {loading.elasticsearch ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Sync Elasticsearch
              </>
            )}
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-indigo-600" />
            <h3 className="text-lg font-semibold">Recommendations</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Update AI-powered recommendations including similar items, personalized recommendations,
            and trending items. This process runs on a daily schedule but can be triggered manually.
          </p>
          <button
            onClick={handleUpdateRecommendations}
            disabled={loading.recommendations}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full justify-center"
          >
            {loading.recommendations ? (
              <>
                <Sparkles size={18} className="animate-pulse" />
                Updating...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Update Recommendations
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}