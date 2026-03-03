#!/usr/bin/env node
/**
 * Check Meta User Access Token Status
 * Helps diagnose token expiration and provides renewal guidance
 */

async function checkMetaToken() {
  const userToken = process.env.META_USER_ACCESS_TOKEN;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!userToken) {
    console.error('❌ META_USER_ACCESS_TOKEN not found in environment');
    process.exit(1);
  }

  console.log('🔍 Checking Meta User Access Token Status...\n');

  try {
    // Check token validity
    const debugRes = await fetch(`https://graph.facebook.com/v19.0/debug_token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_token: userToken,
        access_token: `${appId}|${appSecret}`,
      }),
    });

    const debugData = await debugRes.json();

    if (debugData.error) {
      console.error(`❌ Token Debug Error: ${debugData.error.message}\n`);
      printRenewalGuide();
      process.exit(1);
    }

    const tokenInfo = debugData.data;
    console.log('📋 Token Information:');
    console.log(`  User ID: ${tokenInfo.user_id}`);
    console.log(`  App ID: ${tokenInfo.app_id}`);
    console.log(`  Is Valid: ${tokenInfo.is_valid ? '✓' : '✗'}`);

    if (tokenInfo.expires_at) {
      const expiryDate = new Date(tokenInfo.expires_at * 1000);
      console.log(`  Token Expires: ${expiryDate.toISOString()}`);
    }

    if (tokenInfo.data_access_expires_at) {
      const expiryDate = new Date(tokenInfo.data_access_expires_at * 1000);
      const now = new Date();
      const days = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  Data Access Expires: ${expiryDate.toISOString()}`);
      console.log(`  Days Until Expiry: ${days}\n`);

      if (days <= 0) {
        console.error(`❌ Token has EXPIRED!\n`);
        printRenewalGuide();
        process.exit(1);
      } else if (days <= 14) {
        console.error(`⚠️  Token expires in ${days} days - Please renew soon!\n`);
      } else {
        console.log(`✓ Token is healthy\n`);
      }
    }

    // Try to get fresh page token
    if (pageId) {
      console.log('🔄 Attempting to refresh page token...');
      const pageRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userToken}`);
      const pageData = await pageRes.json();

      if (pageData.access_token) {
        console.log('✓ Fresh page token obtained successfully\n');
      } else if (pageData.error) {
        console.error(`❌ Page token refresh failed: ${pageData.error.message}\n`);
        console.error('📌 This suggests the user token is invalid or expired.\n');
        printRenewalGuide();
        process.exit(1);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`);
    printRenewalGuide();
    process.exit(1);
  }
}

function printRenewalGuide() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    META TOKEN RENEWAL GUIDE                        ║
╚════════════════════════════════════════════════════════════════════╝

If your Meta user access token has expired, follow these steps to renew it:

1. Go to Facebook App Dashboard:
   https://developers.facebook.com/apps

2. Select your app (ID: ${process.env.META_APP_ID})

3. Go to Tools → Graph API Explorer

4. In the "User or Page" dropdown, select your Facebook Page

5. In "Permissions" section, select:
   - pages_manage_metadata
   - pages_read_engagement
   - pages_read_user_content
   - instagram_basic
   - instagram_manage_insights

6. Click "Generate Access Token"

7. Copy the generated token and update:
   FACEBOOK_PAGE_ACCESS_TOKEN = <new token>
   META_USER_ACCESS_TOKEN = <new token>

8. Deploy with the new token

⚠️  IMPORTANT NOTES:
  - User tokens are long-lived (60 days)
  - Page tokens are short-lived (hours to days)
  - Always keep both tokens updated
  - The app auto-refreshes page tokens before publishing
  
📚 More info:
   https://developers.facebook.com/docs/facebook-login/access-tokens

`);
}

checkMetaToken().catch(console.error);
