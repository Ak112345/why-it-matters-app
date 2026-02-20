'use client';

import { useEffect, useState } from 'react';

interface AttentionItem {
  id: string;
  type: 'failed_publish' | 'attribution_needed' | 'stuck_upload';
  title: string;
  description: string;
  videoId?: string;
  clipId?: string;
  platform?: string;
  timestamp: string;
}

interface AttentionSummary {
  failed: number;
  stuck: number;
  attribution: number;
}

export function AttentionPanel() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [, setSummary] = useState<AttentionSummary>({ failed: 0, stuck: 0, attribution: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttentionItems();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAttentionItems, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAttentionItems() {
    try {
      const response = await fetch('/api/attention');
      const data = await response.json();
      
      if (data.success) {
        setItems(data.items || []);
        setSummary(data.summary || { failed: 0, stuck: 0, attribution: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch attention items:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <aside className="panel attention">
        <h3>Needs Attention</h3>
        <p style={{ opacity: 0.6, fontSize: '14px' }}>Loading...</p>
      </aside>
    );
  }

  if (items.length === 0) {
    return (
      <aside className="panel attention">
        <h3>Needs Attention</h3>
        <p style={{ opacity: 0.6, fontSize: '14px', color: 'var(--sage)' }}>
          ✓ All clear
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel attention">
      <h3>Needs Attention</h3>
      <ul className="attention-list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

interface AttentionStatusProps {
  summary?: AttentionSummary;
}

export function AttentionStatus({ summary }: AttentionStatusProps) {
  const [currentSummary, setCurrentSummary] = useState<AttentionSummary>(
    summary || { failed: 0, stuck: 0, attribution: 0 }
  );

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSummary() {
    try {
      const response = await fetch('/api/attention');
      const data = await response.json();
      
      if (data.success && data.summary) {
        setCurrentSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch attention summary:', error);
    }
  }

  const total = currentSummary.failed + currentSummary.stuck;

  if (total === 0) {
    return (
      <div className="status-card">
        <span className="label">Needs Attention</span>
        <strong style={{ color: 'var(--sage)' }}>✓ All clear</strong>
      </div>
    );
  }

  const parts = [];
  if (currentSummary.failed > 0) {
    parts.push(`${currentSummary.failed} failed`);
  }
  if (currentSummary.stuck > 0) {
    parts.push(`${currentSummary.stuck} stuck`);
  }

  return (
    <div className="status-card">
      <span className="label">Needs Attention</span>
      <strong>{parts.join(' · ')}</strong>
    </div>
  );
}
