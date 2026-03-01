import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  console.log('Deleting error videos...');
  const { data, error, count } = await supabase
    .from("videos_final")
    .delete()
    .eq("status", "error")
    .select('id');
    
  if (error) {
    console.error("Error deleting videos:", error);
  } else {
    console.log(`Successfully deleted ${count} error videos`);
  }
})().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
