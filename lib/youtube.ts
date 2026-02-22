// lib/youtube.ts
import { google } from "googleapis";

export function getYoutubeClients() {
  const clientId = process.env.YOUTUBE_CLIENT_ID!;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET!;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN!;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing YouTube env vars: YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const ytAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth2 });

  return { oauth2, youtube, ytAnalytics };
}