// lib/meta.ts
export const META_GRAPH = "https://graph.facebook.com/v19.0";

export function getMetaEnv() {
  const pageId = process.env.FACEBOOK_PAGE_ID!;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
  const igId = process.env.INSTAGRAM_BUSINESS_ID!;
  if (!pageId || !token || !igId) throw new Error("Missing Meta env vars");
  return { pageId, token, igId };
}

export async function metaGet<T>(path: string, token: string) {
  const url = new URL(`${META_GRAPH}/${path}`);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Meta API error");
  return json as T;
}