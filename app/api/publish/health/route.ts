import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;

    if (!workerUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing RAILWAY_WORKER_URL',
        },
        { status: 500 }
      );
    }

    const res = await fetch(`${workerUrl}/health`, {
      method: 'GET',
      headers: workerSecret ? { 'x-worker-secret': workerSecret } : {},
    });

    const text = await res.text();
    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(
      {
        success: res.ok,
        worker: data,
      },
      { status: res.ok ? 200 : 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to contact Railway worker',
      },
      { status: 500 }
    );
  }
}
