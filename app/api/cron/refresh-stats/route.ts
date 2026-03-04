// app/api/cron/refresh-stats/route.ts
// Vercel Cron job to periodically refresh analytics from Railway worker
// Add to vercel.json: { "crons": [{ "path": "/api/cron/refresh-stats", "schedule": "0 */2 * * *" }] }

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const railwayUrl = process.env.RAILWAY_WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;

    if (!railwayUrl || !workerSecret) {
      return Response.json({ error: 'Missing RAILWAY_WORKER_URL or WORKER_SECRET' }, { status: 500 });
    }

    console.log('[cron] Triggering stats refresh on Railway worker...');

    const response = await fetch(`${railwayUrl}/stats/refresh`, {
      method: 'POST',
      headers: {
        'x-worker-secret': workerSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hoursOld: 2,  // Only refresh posts not synced in last 2 hours
        daysBack: 7,  // Only sync posts from last 7 days
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Railway worker returned ${response.status}: ${JSON.stringify(data)}`);
    }

    console.log('[cron] Stats refresh complete:', data);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      railwayResponse: data,
    });
  } catch (error: any) {
    console.error('[cron] Stats refresh failed:', error.message);
    return Response.json(
      {
        success: false,
        error: error?.message || 'Stats refresh failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
