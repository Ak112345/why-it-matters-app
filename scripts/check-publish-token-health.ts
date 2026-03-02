import { checkAllPublishTokenHealth } from '../src/distribution/tokenHealth.ts';

async function main() {
  const results = await checkAllPublishTokenHealth();
  const ok = results.every((result) => result.ok);

  console.log(JSON.stringify({ success: ok, results }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error: any) => {
  console.error('[token-health] fatal:', error?.message || error);
  process.exit(1);
});
