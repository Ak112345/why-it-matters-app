'use client';

import { useState, useEffect } from 'react';

interface TokenStatus {
  platform: string;
  token_type: string;
  status: 'healthy' | 'warning' | 'critical' | 'expired' | 'unknown';
  message: string;
  expires_at?: string;
  days_until_expiry?: number;
}

interface TokenHealthResponse {
  success: boolean;
  timestamp: string;
  tokens: TokenStatus[];
  alerts_created: number;
}

export default function TokenHealthPanel() {
  const [health, setHealth] = useState<TokenHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tokens/health');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch token health');
      }
      
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: TokenStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'expired':
        return 'bg-red-200 text-red-900 border-red-400';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: TokenStatus['status']) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '🚨';
      case 'expired':
        return '❌';
      default:
        return '❓';
    }
  };

  if (loading && !health) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Token Health</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Token Health</h2>
        <div className="bg-red-50 border border-red-300 rounded p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchHealth}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Token Health Monitor</h2>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {health && (
        <>
          <div className="text-sm text-gray-600 mb-4">
            Last checked: {new Date(health.timestamp).toLocaleString()}
          </div>

          <div className="space-y-3">
            {health.tokens.map((token, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getStatusColor(token.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getStatusIcon(token.status)}</span>
                      <div>
                        <h3 className="font-bold text-lg capitalize">
                          {token.platform}
                        </h3>
                        <p className="text-xs opacity-75">{token.token_type}</p>
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium mb-1">{token.message}</p>
                    
                    {token.expires_at && (
                      <div className="text-xs opacity-75 mt-2">
                        <p>Expires: {new Date(token.expires_at).toLocaleDateString()}</p>
                        {token.days_until_expiry !== undefined && (
                          <p className="font-semibold mt-1">
                            {token.days_until_expiry > 0
                              ? `${token.days_until_expiry} days remaining`
                              : 'EXPIRED'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    token.status === 'healthy' ? 'bg-green-200' :
                    token.status === 'warning' ? 'bg-yellow-200' :
                    token.status === 'critical' ? 'bg-red-200' :
                    token.status === 'expired' ? 'bg-red-300' :
                    'bg-gray-200'
                  }`}>
                    {token.status}
                  </div>
                </div>

                {(token.status === 'critical' || token.status === 'expired') && (
                  <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                    <p className="text-xs font-bold">
                      🔧 Action Required: 
                      {token.platform === 'meta' && (
                        <span className="ml-1">
                          Generate new long-lived user token from Meta Graph Explorer
                        </span>
                      )}
                      {token.platform === 'youtube' && (
                        <span className="ml-1">
                          Re-authenticate and get new refresh token
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {health.alerts_created > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-300 rounded">
              <p className="text-sm text-orange-800">
                ⚠️ {health.alerts_created} alert{health.alerts_created > 1 ? 's' : ''} created for token issues
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
