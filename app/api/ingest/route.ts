/**
 * API endpoint to trigger clip ingestion from Pexels/Pixabay
 * POST /api/ingest
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestClips } from '../../../src/ingestion/ingestClips';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      source = 'all',
      query = 'nature',
      count = 5,
      // usePopular parameter is accepted but currently unused
    } = body;

    console.log(`Starting ingestion: source=${source}, query=${query}, count=${count}`);

    // Note: source, count, and usePopular parameters are currently unused
    // ingestClips only accepts a query string
    const result = await ingestClips(query);

    const attribution = source === 'pixabay' || source === 'all'
      ? {
          pixabay: 'Pixabay assets require attribution when search results are displayed.'
        }
      : undefined;

    return NextResponse.json({
      success: true,
      message: `Ingested ${result.inserted} clips successfully`,
      data: result,
      attribution,
    });
  } catch (error) {
    console.error('Error in ingest API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Clip Ingestion API',
    usage: 'POST with JSON body: { source: "pexels" | "pixabay" | "all", query: string, count: number, usePopular: boolean }',
  });
}
