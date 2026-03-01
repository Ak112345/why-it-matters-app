#!/usr/bin/env node

/**
 * Direct OpenAI API test script
 * Run with: npx ts-node scripts/test-openai.ts
 */

import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testOpenAI() {
  console.log('🔍 Testing OpenAI API Connection...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  const projectId = process.env.OPENAI_PROJECT_ID;

  console.log('📋 Configuration:');
  console.log('  API Key:', apiKey ? `${apiKey.slice(0, 20)}...` : '❌ NOT SET');
  console.log('  Project ID:', projectId || '❌ NOT SET');
  console.log('');

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in .env.local');
    process.exit(1);
  }

  try {
    console.log('🚀 Creating OpenAI client...');
    const openai = new OpenAI({
      apiKey,
      project: projectId || undefined,
    });

    console.log('📤 Sending test request to GPT-4o-mini...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Return a JSON response.',
        },
        {
          role: 'user',
          content:
            'Create a viral video hook in one punchy sentence about technology. Start with "Nobody\'s talking about". Return JSON with key "hook".',
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(response);

    console.log('\n✅ SUCCESS! OpenAI API is working\n');
    console.log('📊 Response Details:');
    console.log('  Model:', completion.model);
    console.log('  Tokens used:', completion.usage?.total_tokens);
    console.log('  Input tokens:', completion.usage?.prompt_tokens);
    console.log('  Output tokens:', completion.usage?.completion_tokens);
    console.log('\n💡 Generated Hook:');
    console.log(' ', parsed.hook);
    console.log('\n✨ Your OpenAI API is fully functional!');
  } catch (error) {
    console.error('\n❌ ERROR with OpenAI API:\n');
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Name:', error.name);
      
      if ('status' in error) {
        console.error('Status:', (error as any).status);
      }
      if ('code' in error) {
        console.error('Code:', (error as any).code);
      }
      if ('headers' in error) {
        console.error('Headers:', JSON.stringify((error as any).headers, null, 2));
      }
    } else {
      console.error('Error:', error);
    }

    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Verify your API key in .env.local');
    console.log('  2. Check https://platform.openai.com/api/keys');
    console.log('  3. Verify the model "gpt-4o-mini" is available');
    console.log('  4. Check your account has available credits/quota');
    process.exit(1);
  }
}

testOpenAI();
