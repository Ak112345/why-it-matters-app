import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('Meta Environment Variables:');
console.log({
  META_USER_ACCESS_TOKEN_exists: !!process.env.META_USER_ACCESS_TOKEN,
  META_USER_ACCESS_TOKEN_length: process.env.META_USER_ACCESS_TOKEN?.length || 0,
  FACEBOOK_PAGE_ID_exists: !!process.env.FACEBOOK_PAGE_ID,
  FACEBOOK_PAGE_ACCESS_TOKEN_exists: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  META_IG_BUSINESS_ID_exists: !!process.env.META_IG_BUSINESS_ID,
  INSTAGRAM_ACCESS_TOKEN_exists: !!process.env.INSTAGRAM_ACCESS_TOKEN,
});

// Test Meta User Token and get Page Token
const testMetaTokens = async () => {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const userToken = process.env.META_USER_ACCESS_TOKEN;

  if (!pageId || !userToken) {
    console.log('\n❌ Missing FACEBOOK_PAGE_ID or META_USER_ACCESS_TOKEN');
    return;
  }

  try {
    // Test 1: Get fresh page token from user token
    console.log('\n🔄 Testing Meta User Token & Page Token refresh...');
    const pageRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=access_token,name&access_token=${userToken}`
    );
    const pageData: any = await pageRes.json();

    if (pageData.error) {
      console.log('❌ PAGE TOKEN ERROR:', pageData.error.code, '-', pageData.error.message);
      if (pageData.error.code === 190) {
        console.log('   ⚠️  User access token is expired or invalid. Needs refresh!');
      }
    } else if (pageData.access_token) {
      console.log('✅ PAGE TOKEN VALID - Page:', pageData.name);
      console.log('   Token length:', pageData.access_token.length);

      // Test 2: Verify Instagram access with the page token
      const igUserId = process.env.META_IG_BUSINESS_ID;
      if (igUserId) {
        console.log('\n🔄 Testing Instagram Business Account access...');
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${igUserId}?fields=id,username&access_token=${pageData.access_token}`
        );
        const igData: any = await igRes.json();

        if (igData.error) {
          console.log('❌ INSTAGRAM ERROR:', igData.error.code, '-', igData.error.message);
        } else {
          console.log('✅ INSTAGRAM ACCESS VALID - Username:', igData.username || igData.id);
        }
      }
    }

    // Test 3: Check user token expiry
    console.log('\n🔄 Checking user token expiration...');
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${userToken}&access_token=${userToken}`
    );
    const debugData: any = await debugRes.json();

    if (debugData.data) {
      const expiresAt = debugData.data.expires_at;
      if (expiresAt === 0) {
        console.log('✅ USER TOKEN: Never expires (long-lived)');
      } else {
        const expiryDate = new Date(expiresAt * 1000);
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        console.log('⏰ USER TOKEN EXPIRES:', expiryDate.toISOString());
        console.log('   Days until expiry:', daysUntilExpiry);
        if (daysUntilExpiry < 7) {
          console.log('   ⚠️  WARNING: Token expires soon!');
        }
      }
    }
  } catch (err: any) {
    console.log('\n❌ Error:', err.message);
  }
};

testMetaTokens();
