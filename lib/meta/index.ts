import fetch from 'node-fetch';

export async function metaApiRequest(endpoint: string, accessToken: string, params: Record<string, string | number> = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, String(value)));
  url.searchParams.append('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`);
  return res.json();
}

// Simple in-memory cache (for Vercel serverless)
const cache: Record<string, { data: any; expires: number }> = {};
export async function cachedMetaApiRequest(endpoint: string, accessToken: string, params: Record<string, string | number> = {}, cacheMinutes = 10) {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
  const now = Date.now();
  if (cache[cacheKey] && cache[cacheKey].expires > now) {
    return cache[cacheKey].data;
  }
  const data = await metaApiRequest(endpoint, accessToken, params);
  cache[cacheKey] = { data, expires: now + cacheMinutes * 60 * 1000 };
  return data;
}
