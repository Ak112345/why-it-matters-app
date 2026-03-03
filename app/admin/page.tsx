"use client";
import React, { useEffect, useState } from "react";
import TokenHealthPanel from "../../src/components/TokenHealthPanel";

interface QueueStats {
  pending: number;
  posted: number;
  failed: number;
  total?: number;
  data?: {
    summary?: {
      total: number;
      pending: number;
      posted: number;
      failed: number;
      readyToPost: number;
    };
    byPlatform?: Record<string, { total: number; pending: number; failed: number; posted: number }>;
  };
}

export default function AdminPage() {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishResult, setPublishResult] = useState<any>(null);
  const [publishingNow, setPublishingNow] = useState(false);
  const [bulkFinalizing, setBulkFinalizing] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchQueueStats = async () => {
    try {
      const res = await fetch('/api/queue/stats', { cache: 'no-store' });
      const data = await res.json();
      setQueueStats(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch queue stats:', err);
      setLoading(false);
    }
  };

  const triggerPublishNow = async () => {
    setPublishingNow(true);
    setPublishResult(null);
    try {
      const res = await fetch('/api/publish/cron');
      const data = await res.json();
      setPublishResult(data);
      // Refresh stats after publish
      setTimeout(fetchQueueStats, 2000);
    } catch (err: any) {
      setPublishResult({ success: false, error: err.message });
    } finally {
      setPublishingNow(false);
    }
  };

  const triggerContentGeneration = async () => {
    const confirmed = confirm('Generate new content? This will ingest clips, analyze, produce videos, and queue them.');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/content/generate');
      const data = await res.json();
      alert(data.message || 'Content generation started');
      setTimeout(fetchQueueStats, 5000);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const triggerBulkFinalize = async () => {
    const confirmed = confirm('Bulk finalize up to 20 clips? This will produce videos from the backlog and queue them for all platforms.');
    if (!confirmed) return;

    setBulkFinalizing(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/content/bulk-finalize?batchSize=20');
      const data = await res.json();
      setBulkResult(data);
      setTimeout(fetchQueueStats, 3000);
    } catch (err: any) {
      setBulkResult({ success: false, error: err.message });
    } finally {
      setBulkFinalizing(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            margin: 0,
            fontSize: '36px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Why It Matters Dashboard
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '16px' }}>
            Content production & publishing control center
          </p>
        </div>

        {/* Action Cards Row */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          {/* Publish Now Card */}
          <button
            onClick={triggerPublishNow}
            disabled={publishingNow}
            style={{
              background: publishingNow ? '#9333ea' : 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
              border: 'none',
              borderRadius: '16px',
              padding: '32px',
              color: 'white',
              cursor: publishingNow ? 'wait' : 'pointer',
              boxShadow: '0 10px 30px rgba(168, 85, 247, 0.3)',
              transition: 'all 0.3s ease',
              textAlign: 'left',
              transform: publishingNow ? 'scale(0.98)' : 'scale(1)',
            }}
            onMouseOver={(e) => {
              if (!publishingNow) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(168, 85, 247, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!publishingNow) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(168, 85, 247, 0.3)';
              }
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚀</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              {publishingNow ? 'Publishing...' : 'Publish Now'}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Post all pending videos to social media
            </div>
          </button>

          {/* Generate Content Card */}
          <button
            onClick={triggerContentGeneration}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '16px',
              padding: '32px',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.3s ease',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(16, 185, 129, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.3)';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              Generate Content
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Ingest clips, analyze, and produce videos
            </div>
          </button>

          {/* Refresh Stats Card */}
          <button
            onClick={fetchQueueStats}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: '16px',
              padding: '32px',
              color: 'white',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.3s ease',
              textAlign: 'left'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔄</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              {loading ? 'Refreshing...' : 'Refresh Stats'}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Update queue statistics
            </div>
          </button>

          {/* Bulk Finalize Card */}
          <button
            onClick={triggerBulkFinalize}
            disabled={bulkFinalizing}
            style={{
              background: bulkFinalizing ? '#d97706' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '16px',
              padding: '32px',
              color: 'white',
              cursor: bulkFinalizing ? 'wait' : 'pointer',
              boxShadow: '0 10px 30px rgba(245, 158, 11, 0.3)',
              transition: 'all 0.3s ease',
              textAlign: 'left',
              transform: bulkFinalizing ? 'scale(0.98)' : 'scale(1)',
            }}
            onMouseOver={(e) => {
              if (!bulkFinalizing) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(245, 158, 11, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!bulkFinalizing) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(245, 158, 11, 0.3)';
              }
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
              {bulkFinalizing ? 'Processing...' : 'Bulk Finalize'}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Process backlog clips → final videos + queue
            </div>
          </button>
        </div>

        {/* Queue Stats Cards */}
        {queueStats && (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                PENDING
              </div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '8px' }}>
                {queueStats.pending ?? queueStats.data?.summary?.pending ?? 0}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Videos waiting to post
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                POSTED
              </div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
                {queueStats.posted ?? queueStats.data?.summary?.posted ?? 0}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Successfully published
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                FAILED
              </div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>
                {queueStats.failed ?? queueStats.data?.summary?.failed ?? 0}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Publishing errors
              </div>
            </div>

            {queueStats.data?.byPlatform?.tiktok && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                  TIKTOK QUEUED
                </div>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>
                  {queueStats.data.byPlatform.tiktok.pending}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Ready for manual scheduling
                </div>
              </div>
            )}
          </div>
        )}

        {/* Publish Result */}
        {publishResult && (
          <div style={{
            background: publishResult.success ? '#d1fae5' : '#fee2e2',
            border: `2px solid ${publishResult.success ? '#10b981' : '#ef4444'}`,
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            color: publishResult.success ? '#065f46' : '#991b1b'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
              {publishResult.success ? '✅ Publish Complete' : '❌ Publish Failed'}
            </div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {publishResult.message}
            </div>
            {publishResult.results && publishResult.results.length > 0 && (
              <div style={{ marginTop: '16px', fontSize: '14px' }}>
                {publishResult.results.map((r: any, i: number) => (
                  <div key={i} style={{ 
                    padding: '8px',
                    background: 'rgba(255,255,255,0.5)',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}>
                    <strong>{r.platform}:</strong> {r.success ? '✅ Success' : `❌ ${r.error}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bulk Finalize Result */}
        {bulkResult && (
          <div style={{
            background: bulkResult.success ? '#fef3c7' : '#fee2e2',
            border: `2px solid ${bulkResult.success ? '#f59e0b' : '#ef4444'}`,
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            color: bulkResult.success ? '#92400e' : '#991b1b'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
              {bulkResult.success ? '📦 Bulk Finalize Complete' : '❌ Bulk Finalize Failed'}
            </div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {bulkResult.message || bulkResult.error}
            </div>
            {bulkResult.produced && (
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                Produced: {bulkResult.produced.succeeded}/{bulkResult.produced.attempted} videos •
                Queued: {bulkResult.queued?.count || 0} (incl. TikTok for manual scheduling)
              </div>
            )}
          </div>
        )}

        {/* Token Health Monitor */}
        <TokenHealthPanel />
      </div>
    </div>
  );
}
