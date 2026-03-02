#!/usr/bin/env ts-node
/**
 * Extract Facebook/Instagram Page Access Token from User Access Token
 * 
 * Usage: npm run extract:page-token
 * 
 * This script:
 * 1. Reads META_USER_ACCESS_TOKEN from .env.local
 * 2. Calls Meta Graph API to fetch your pages/accounts
 * 3. Extracts the access_token and business account ID
 * 4. Displays them for manual update to .env.local
 */

import * as fs from 'fs';
import * as path from 'path';

const META_API_VERSION = 'v19.0';
const API_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Parse META_USER_ACCESS_TOKEN
const match = envContent.match(/META_USER_ACCESS_TOKEN="([^"]+)"/);
if (!match || !match[1]) {
  console.error('❌ META_USER_ACCESS_TOKEN not found in .env.local');
  process.exit(1);
}

const userToken = match[1];
console.log(`📝 Using user token: ${userToken.slice(0, 20)}...${userToken.slice(-10)}`);

// Fetch pages from Meta API
async function extractPageToken() {
  try {
    console.log(`\n🔄 Fetching pages from Meta Graph API...`);
    
    const response = await fetch(`${API_URL}/me/accounts?fields=id,name,access_token&access_token=${userToken}`);
    const data = (await response.json()) as any;

    if (data.error) {
      console.error(`\n❌ Meta API Error: ${data.error.message}`);
      console.error(`   Code: ${data.error.code}`);
      console.error(`\n💡 This token is likely expired or invalid.`);
      console.error(`   Please generate a new User Access Token from Meta Developers:\n`);
      console.error(`   1. Go to Meta Developers → Your App → Tools → Access Token Debugger`);
      console.error(`   2. Generate a new User Access Token with scopes:`);
      console.error(`      - pages_read_engagement`);
      console.error(`      - pages_manage_posts`);
      console.error(`      - instagram_basic`);
      console.error(`      - instagram_manage_insights`);
      console.error(`   3. Copy the token and update META_USER_ACCESS_TOKEN in .env.local`);
      console.error(`   4. Run this script again\n`);
      process.exit(1);
    }

    if (!data.data || data.data.length === 0) {
      console.error('❌ No pages found. Verify your Meta account is set up correctly.');
      process.exit(1);
    }

    console.log(`\n✅ Found ${data.data.length} page(s):\n`);

    // Display all pages with their tokens
    data.data.forEach((page: any, index: number) => {
      console.log(`📄 Page ${index + 1}: ${page.name}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   Access Token: ${page.access_token.slice(0, 30)}...${page.access_token.slice(-10)}`);
      console.log(`   (Full length: ${page.access_token.length} chars)\n`);
    });

    // Use the first page's token
    const pageToken = data.data[0].access_token;
    const pageId = data.data[0].id;

    console.log(`💾 Primary page token to use:\n`);
    console.log(`FACEBOOK_PAGE_ACCESS_TOKEN="${pageToken}"`);
    console.log(`META_FACEBOOK_ID="${pageId}"\n`);

    console.log(`📋 Update .env.local with these values and restart the app.\n`);

    // Optional: Offer to auto-update
    if (process.argv.includes('--update')) {
      const envLines = envContent.split('\n');
      const updated = envLines.map((line) => {
        if (line.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN=')) {
          return `FACEBOOK_PAGE_ACCESS_TOKEN="${pageToken}"`;
        }
        if (line.startsWith('META_FACEBOOK_ID=')) {
          return `META_FACEBOOK_ID="${pageId}"`;
        }
        return line;
      });

      fs.writeFileSync(envPath, updated.join('\n'));
      console.log('✅ Auto-updated .env.local with new tokens!');
    }

  } catch (error) {
    console.error('❌ Error fetching pages:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run
extractPageToken();
