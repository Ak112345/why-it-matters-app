import React, { useEffect, useState } from 'react';

function fetchWithAuth(url: string) {
  // Replace with your actual access token retrieval logic
  const accessToken = '';
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(res => res.json());
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [recent, setRecent] = useState<any>(null);
  const [top, setTop] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);

  useEffect(() => {
    fetchWithAuth('/api/youtube/overview').then(setOverview);
    fetchWithAuth('/api/youtube/recent?limit=20').then(setRecent);
    fetchWithAuth('/api/youtube/top?days=7&limit=10').then(setTop);
    fetchWithAuth('/api/youtube/trends?days=28').then(setTrends);
  }, []);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <section>
        <h2>Channel Overview</h2>
        <pre>{JSON.stringify(overview, null, 2)}</pre>
      </section>
      <section>
        <h2>Recent Uploads</h2>
        <pre>{JSON.stringify(recent, null, 2)}</pre>
      </section>
      <section>
        <h2>Top Performing Videos</h2>
        <pre>{JSON.stringify(top, null, 2)}</pre>
      </section>
      <section>
        <h2>Trends</h2>
        <pre>{JSON.stringify(trends, null, 2)}</pre>
      </section>
    </div>
  );
}
