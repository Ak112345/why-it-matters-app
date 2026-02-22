"use client";
import React, { useEffect, useState } from "react";

function fetchWithAuth(url: string) {
  const accessToken = "";
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((res) => res.json());
}

export default function AdminPage() {
  const fbTokenExpiry = new Date("2026-04-23");
  const now = new Date();
  const daysToExpiry = Math.ceil((fbTokenExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
    fetchWithAuth("/api/youtube/overview").then(setOverview);
    fetchWithAuth("/api/youtube/recent?limit=20").then(setRecent);
    fetchWithAuth("/api/youtube/top?days=7&limit=10").then(setTop);
    fetchWithAuth("/api/youtube/trends?days=28").then(setTrends);
    const fbPageId = "1052339091287287";
    const igId = "17841480679369169";
    fetchWithAuth(`/api/meta/overview?fbPageId=${fbPageId}&igId=${igId}`).then(setMetaOverview);
    fetchWithAuth(`/api/meta/recent?fbPageId=${fbPageId}&igId=${igId}`).then(setMetaRecent);
    fetchWithAuth(`/api/meta/top?fbPageId=${fbPageId}&igId=${igId}&days=7&limit=10`).then(setMetaTop);
    fetchWithAuth(`/api/meta/trends?fbPageId=${fbPageId}&igId=${igId}&days=28`).then(setMetaTrends);
    fetchWithAuth(`/api/meta/carousels?igId=${igId}`).then(setMetaCarousels);
    fetchWithAuth("/api/meta/articles").then(setMetaArticles);
  }, []);

  return (
    <div>
      {daysToExpiry <= 7 && (
        <div style={{ background: "#fffbe6", color: "#ad6800", padding: "12px", borderRadius: "6px", marginBottom: "16px", border: "1px solid #ffe58f" }}>
          <strong>Reminder:</strong> Your Facebook token expires in {daysToExpiry} day{daysToExpiry !== 1 ? "s" : ""} (April 23, 2026).
        </div>
      )}
      <h1>Admin Dashboard</h1>
      <div>
        <h2>Meta Carousels</h2>
        <pre>{JSON.stringify(metaCarousels, null, 2)}</pre>
      </div>
      <div>
        <h2>Newspaper Articles</h2>
        <pre>{JSON.stringify(metaArticles, null, 2)}</pre>
      </div>
      <div>
        <h2>YouTube Overview</h2>
        <pre>{JSON.stringify(overview, null, 2)}</pre>
      </div>
      <div>
        <h2>YouTube Recent Uploads</h2>
        <pre>{JSON.stringify(recent, null, 2)}</pre>
      </div>
      <div>
        <h2>YouTube Top Videos</h2>
        <pre>{JSON.stringify(top, null, 2)}</pre>
      </div>
      <div>
        <h2>YouTube Trends</h2>
        <pre>{JSON.stringify(trends, null, 2)}</pre>
      </div>
      <div>
        <h2>Meta Overview</h2>
        <pre>{JSON.stringify(metaOverview, null, 2)}</pre>
      </div>
      <div>
        <h2>Meta Recent Posts</h2>
        <pre>{JSON.stringify(metaRecent, null, 2)}</pre>
      </div>
      <div>
        <h2>Meta Top Performers</h2>
        <pre>{JSON.stringify(metaTop, null, 2)}</pre>
      </div>
      <div>
        <h2>Meta Trends</h2>
        <pre>{JSON.stringify(metaTrends, null, 2)}</pre>
      </div>
    </div>
  );
}
