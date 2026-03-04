import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('Environment variables loaded:', {
  YOUTUBE_CLIENT_ID_exists: !!process.env.YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET_exists: !!process.env.YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REFRESH_TOKEN_exists: !!process.env.YOUTUBE_REFRESH_TOKEN,
  YOUTUBE_REFRESH_TOKEN_length: process.env.YOUTUBE_REFRESH_TOKEN?.length || 0
});

const testYouTubeToken = async () => {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    });
    const data: any = await res.json();
    if (data.error) {
      console.log('\n❌ YOUTUBE TOKEN ERROR:', data.error, '-', data.error_description);
    } else if (data.access_token) {
      console.log('\n✅ YOUTUBE TOKEN VALID - Access token length:', data.access_token.length);
      console.log('✅ Token expires in:', data.expires_in, 'seconds');
    }
  } catch (err: any) {
    console.log('\n❌ Error:', err.message);
  }
};

testYouTubeToken();
