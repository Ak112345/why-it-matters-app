/**
 * API endpoint to trigger clip ingestion from Pexels/Pixabay
 * POST /api/ingest
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestClips } from '../../../src/ingestion/ingestClips';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Example env check (add as needed)
  // const API_KEY = process.env.PEXELS_API_KEY;
  // if (!API_KEY) return NextResponse.json({ error: "Missing PEXELS_API_KEY" }, { status: 500 });

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
      { error: 'Failed to ingest clips' },
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
