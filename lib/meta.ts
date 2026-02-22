import fetch from 'node-fetch';

export async function fetchMeta(endpoint: string, accessToken: string, params: Record<string, string | number> = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, String(value)));
  url.searchParams.append('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`);
  return res.json();
}
