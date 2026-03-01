import { NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Simple OpenAI API test endpoint
 * GET /api/test-openai
 */
export async function GET() {
  try {
    console.log('[test-openai] Testing OpenAI API...');
    console.log('[test-openai] Using API key:', process.env.OPENAI_API_KEY?.slice(0, 20) + '...');
    console.log('[test-openai] Using project ID:', process.env.OPENAI_PROJECT_ID);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      project: process.env.OPENAI_PROJECT_ID || undefined,
    });

    console.log('[test-openai] Sending test completion request...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond with valid JSON.' },
        { role: 'user', content: 'Return a JSON object with a single field called "test" with value "success"' },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    console.log('[test-openai] Success! Response:', response);

    return NextResponse.json({
      success: true,
      message: 'OpenAI API is working',
      response: response ? JSON.parse(response) : response,
      model: completion.model,
      usage: completion.usage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[test-openai] Error:', errorMsg);

    // Parse error for more details
    const errorDetails: any = {};
    if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.name = error.name;
      if ('status' in error) errorDetails.status = (error as any).status;
      if ('code' in error) errorDetails.code = (error as any).code;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        details: errorDetails,
        envCheck: {
          hasApiKey: !!process.env.OPENAI_API_KEY,
          hasProjectId: !!process.env.OPENAI_PROJECT_ID,
          apiKeyPrefix: process.env.OPENAI_API_KEY?.slice(0, 10),
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
