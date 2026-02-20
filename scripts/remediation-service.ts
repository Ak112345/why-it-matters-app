/**
 * Auto-Remediation Background Service
 * Runs error detection and auto-fixing on a schedule
 * 
 * Usage:
 *   npm run remediation:start - Start background service (every 5 minutes)
 *   npm run remediation:once - Run once manually
 *   
 * Or set up as a cron job (every 5 minutes):
 *   '* /5 * * * * curl http://localhost:3000/api/errors/detect' (remove space after *)
 * 
 * Or use Vercel Cron (add to vercel.json):
 * @example
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/errors/detect",
 *     "schedule": "* /5 * * * *"
 *   }]
 * }
 * ```
 */

const REMEDIATION_ENDPOINT = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/errors/detect`
  : 'http://localhost:3000/api/errors/detect';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runRemediationCycle() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting error detection & remediation cycle...`);
  
  try {
    const response = await fetch(REMEDIATION_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication if needed
        // 'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] Remediation cycle completed in ${duration}ms`);
    console.log(`  Total errors detected: ${result.summary.total_errors}`);
    console.log(`  Auto-fixed: ${result.summary.auto_fixed}`);
    console.log(`  Needs human review: ${result.summary.needs_human_review}`);
    console.log(`  Retry scheduled: ${result.summary.retry_scheduled}`);
    
    // Log details if verbose
    if (process.env.VERBOSE === 'true') {
      console.log('\nDetailed results:');
      result.results.forEach((r: any, idx: number) => {
        console.log(`  ${idx + 1}. ${r.error.type} - ${r.error.entity}`);
        console.log(`     Action: ${r.remediation.action}`);
        console.log(`     Success: ${r.remediation.success}`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Remediation cycle failed:`, error);
    throw error;
  }
}

async function startBackgroundService() {
  console.log('='.repeat(60));
  console.log('Auto-Remediation Background Service');
  console.log(`Endpoint: ${REMEDIATION_ENDPOINT}`);
  console.log(`Interval: ${INTERVAL_MS / 1000}s`);
  console.log('='.repeat(60));
  
  // Run immediately on start
  await runRemediationCycle().catch(err => {
    console.error('Initial cycle failed:', err);
  });
  
  // Then run on interval
  setInterval(async () => {
    await runRemediationCycle().catch(err => {
      console.error('Scheduled cycle failed:', err);
      // Continue running despite errors
    });
  }, INTERVAL_MS);
  
  console.log('\nBackground service started. Press Ctrl+C to stop.\n');
}

// Check if running as main script
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'once') {
    // Run once and exit
    runRemediationCycle()
      .then(() => {
        console.log('\nSingle run completed successfully.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\nSingle run failed:', error);
        process.exit(1);
      });
  } else {
    // Start background service
    startBackgroundService();
  }
}

export { runRemediationCycle, startBackgroundService };
