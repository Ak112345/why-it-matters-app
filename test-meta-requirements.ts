import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Test Instagram Reels Publishing Requirements
const testInstagramRequirements = async () => {
  console.log('Instagram Reels Publishing Checklist:\n');

  const igUserId = process.env.META_IG_BUSINESS_ID;
  const userToken = process.env.META_USER_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  // 1. Get fresh page token
  const pageRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userToken}`
  );
  const pageData: any = await pageRes.json();
  const accessToken = pageData.access_token;

  // 2. Check Instagram account capabilities
  console.log('📱 Instagram Account Check:');
  const igRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}?fields=id,username,profile_picture_url&access_token=${accessToken}`
  );
  const igData: any = await igRes.json();
  
  if (igData.error) {
    console.log('   ❌ Error:', igData.error.message);
  } else {
    console.log('   ✅ Account:', igData.username || igData.id);
  }

  // 3. Video requirements
  console.log('\n📹 Video Requirements:');
  console.log('   ✅ Format: MP4 (H.264 codec)');
  console.log('   ✅ Aspect Ratio: 9:16 (vertical)');
  console.log('   ✅ Duration: 3-90 seconds for Reels');
  console.log('   ✅ Size: < 100MB');
  console.log('   ✅ Resolution: 1080x1920 recommended');

  // 4. Publishing process
  console.log('\n🔄 Publishing Process:');
  console.log('   1. Create container (POST to /media)');
  console.log('   2. Poll status until FINISHED');
  console.log('   3. Publish container (POST to /media_publish)');
  console.log('   ⏱️  Timeout: 60 seconds polling');

  // 5. Common issues
  console.log('\n⚠️  Common Issues:');
  console.log('   - Video must be publicly accessible via URL');
  console.log('   - Video processing can take 30-60 seconds');
  console.log('   - Rate limits: 25 Reels per 24 hours');
  console.log('   - Caption max: 2,200 characters');
  console.log('   - Requires Instagram Business/Creator account');
};

// Test Facebook Reels Publishing Requirements
const testFacebookRequirements = async () => {
  console.log('\n\nFacebook Reels Publishing Checklist:\n');

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const userToken = process.env.META_USER_ACCESS_TOKEN;

  // Get fresh page token
  const pageRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=access_token,name&access_token=${userToken}`
  );
  const pageData: any = await pageRes.json();
  
  console.log('📄 Facebook Page Check:');
  if (pageData.error) {
    console.log('   ❌ Error:', pageData.error.message);
  } else {
    console.log('   ✅ Page:', pageData.name);
  }

  console.log('\n📹 Video Requirements:');
  console.log('   ✅ Format: MP4 (H.264 codec)');
  console.log('   ✅ Aspect Ratio: 9:16 (vertical)');
  console.log('   ✅ Duration: 3-60 seconds for Reels');
  console.log('   ✅ Size: < 1GB');
  console.log('   ✅ Resolution: 1080x1920 recommended');

  console.log('\n🔄 Publishing Process:');
  console.log('   1. Initialize upload (POST to /videos)');
  console.log('   2. Upload video chunks');
  console.log('   3. Finalize upload');
  console.log('   ⏱️  Upload can take 30-90 seconds');

  console.log('\n⚠️  Common Issues:');
  console.log('   - Video must be publicly accessible via URL');
  console.log('   - Page must have posting permissions');
  console.log('   - Caption max: 63,206 characters');
};

(async () => {
  await testInstagramRequirements();
  await testFacebookRequirements();
})();
