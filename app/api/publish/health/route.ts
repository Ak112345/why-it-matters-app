import { NextResponse } from 'next/server';
import { checkAllPublishTokenHealth } from '../../../../src/distribution/tokenHealth';

export async function GET() {
  try {
    const results = await checkAllPublishTokenHealth();
    const ok = results.every((result) => result.ok);

    return NextResponse.json(
      {
        success: ok,
        results,
      },
      { status: ok ? 200 : 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to run token health checks',
      },
      { status: 500 }
    );
  }
}
