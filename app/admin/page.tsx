import React, { useEffect, useState } from 'react';

function fetchWithAuth(url: string) {
  // Replace with your actual access token retrieval logic
  const accessToken = '';
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(res => res.json());
}

export default function AdminDashboard() {
    const [metaCarousels, setMetaCarousels] = useState<any>(null);
    const [metaArticles, setMetaArticles] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [recent, setRecent] = useState<any>(null);
  const [top, setTop] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [metaOverview, setMetaOverview] = useState<any>(null);
  const [metaRecent, setMetaRecent] = useState<any>(null);
  const [metaTop, setMetaTop] = useState<any>(null);
  const [metaTrends, setMetaTrends] = useState<any>(null);

  useEffect(() => {
    fetchWithAuth('/api/youtube/overview').then(setOverview);
    fetchWithAuth('/api/youtube/recent?limit=20').then(setRecent);
    fetchWithAuth('/api/youtube/top?days=7&limit=10').then(setTop);
    fetchWithAuth('/api/youtube/trends?days=28').then(setTrends);
    // Meta API calls (replace fbPageId/igId with actual values)
    const fbPageId = process.env.NEXT_PUBLIC_FACEBOOK_PAGE_ID || process.env.FACEBOOK_PAGE_ID || '1020486651138439';
    const igId = process.env.NEXT_PUBLIC_INSTAGRAM_USER_ID || process.env.INSTAGRAM_USER_ID || '17841480679369169';
    fetchWithAuth(`/api/meta/overview?fbPageId=${fbPageId}&igId=${igId}`).then(setMetaOverview);
    fetchWithAuth(`/api/meta/recent?fbPageId=${fbPageId}&igId=${igId}`).then(setMetaRecent);
    fetchWithAuth(`/api/meta/top?fbPageId=${fbPageId}&igId=${igId}&days=7&limit=10`).then(setMetaTop);
    fetchWithAuth(`/api/meta/trends?fbPageId=${fbPageId}&igId=${igId}&days=28`).then(setMetaTrends);
    fetchWithAuth(`/api/meta/carousels?igId=${igId}`).then(setMetaCarousels);
    fetchWithAuth(`/api/meta/articles`).then(setMetaArticles);
  }, []);

  return (
          <section>
            <h2>Meta Carousels</h2>
            <pre>{JSON.stringify(metaCarousels, null, 2)}</pre>
          </section>
          <section>
            <h2>Newspaper Articles</h2>
            <pre>{JSON.stringify(metaArticles, null, 2)}</pre>
          </section>
    <div>
      <h1>Admin Dashboard</h1>
      <section>
        <h2>YouTube Channel Overview</h2>
        <pre>{JSON.stringify(overview, null, 2)}</pre>
      </section>
      <section>
        <h2>YouTube Recent Uploads</h2>
        <pre>{JSON.stringify(recent, null, 2)}</pre>
      </section>
      <section>
        <h2>YouTube Top Performing Videos</h2>
        <pre>{JSON.stringify(top, null, 2)}</pre>
      </section>
      <section>
        <h2>YouTube Trends</h2>
        <pre>{JSON.stringify(trends, null, 2)}</pre>
      </section>
      <section>
        <h2>Meta Channel Overview</h2>
        <pre>{JSON.stringify(metaOverview, null, 2)}</pre>
      </section>
      <section>
        <h2>Meta Recent Posts</h2>
        <pre>{JSON.stringify(metaRecent, null, 2)}</pre>
      </section>
      <section>
        <h2>Meta Top Performers</h2>
        <pre>{JSON.stringify(metaTop, null, 2)}</pre>
      </section>
      <section>
        <h2>Meta Trends</h2>
        <pre>{JSON.stringify(metaTrends, null, 2)}</pre>
      </section>
    </div>
  );
}
