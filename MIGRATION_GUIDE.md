# 🚀 Database Migration Setup Guide

This guide walks you through setting up the content management database tables required for the approval workflow system.

## 📋 What Gets Installed

Three new database tables are created to support the content management system:

1. **`content_direction`** - Approval status, quality scores, and director feedback
2. **`review_tasks`** - Editorial review workflow management  
3. **`video_performance`** - Analytics and performance metrics

## ✅ Prerequisites

Before running migrations, make sure you have:

- [ ] Supabase project created and running
- [ ] `SUPABASE_URL` in your `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local`
- [ ] Existing `clips` and `videos` tables (from ingestion/production pipelines)

## 🚀 Quick Start (Recommended)

### Option 1: Supabase Dashboard (Easiest)

**Step 1: Open Supabase SQL Editor**
1. Log in to [Supabase](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query** button

**Step 2: Run First Migration**
1. Open `scripts/migrations/001_create_content_direction_table.sql`
2. Copy entire file contents
3. Paste into SQL Editor
4. Click **Run** button (blue play icon)
5. Wait for "Query executed successfully" message ✓

**Step 3: Run Second Migration**
1. Open `scripts/migrations/002_create_review_tasks_table.sql`
2. Paste into a new query
3. Click **Run** ✓

**Step 4: Run Third Migration**
1. Open `scripts/migrations/003_create_video_performance_table.sql`
2. Paste into a new query
3. Click **Run** ✓

**Step 5: Verify Tables Created**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('content_direction', 'review_tasks', 'video_performance');
```

Should show 3 rows:
- content_direction ✓
- review_tasks ✓  
- video_performance ✓

### Option 2: TypeScript Command

If you prefer command line with TypeScript:

```bash
npm run migrate
```

Requirements:
- Node.js installed
- `ts-node` available (part of TypeScript dev dependency)
- Environment variables loaded from `.env.local`

### Option 3: Bash Script

For developers with `psql` installed locally:

```bash
bash scripts/migrations/run.sh
```

This automatically extracts connection info from `SUPABASE_URL` and connects to your database.

## 🔍 Verification

After running migrations, verify everything was created:

**In Supabase SQL Editor:**
```sql
-- Check tables
SELECT table_name, table_type FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('content_direction', 'review_tasks', 'video_performance')
ORDER BY table_name;

-- Check indexes
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('content_direction', 'review_tasks', 'video_performance')
ORDER BY tablename, indexname;
```

Expected output:
- **3 tables** created ✓
- **11 indexes** created ✓

## 🚨 Troubleshooting

### Error: "relation 'clips' does not exist"

**Issue:** The `clips` table doesn't exist yet.

**Solution:** 
The `content_direction` and `review_tasks` tables have foreign key constraints on the `clips` table. You need to ensure the `clips` table exists first.

If it doesn't exist, check:
1. Has the ingestion pipeline been set up?
2. Has `ingestClips()` been called to create the table?
3. Are you using the correct Supabase project?

### Error: "relation 'videos' does not exist"

**Issue:** The `videos` table doesn't exist yet.

**Solution:**
The `video_performance` table references the `videos` table from the production pipeline. Ensure it exists before running migrations or run this separately after `videos` is created.

### Error: "permission denied"

**Issue:** Your Supabase service role key doesn't have permission.

**Solution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct in `.env.local`
2. Check the key starts with `eyJ...` (it's a JWT)
3. Ensure you're using the **Service Role Key**, not the **Anon Key**
4. Try in Supabase Dashboard (which auto-authenticates)

### Error: "already exists"

**Issue:** Tables were already created on a previous run.

**Solution:**
This is fine! The migrations use `CREATE TABLE IF NOT EXISTS`. Simply re-run and it will skip existing tables.

To force re-create (⚠️ deletes data):
```sql
DROP TABLE IF EXISTS video_performance CASCADE;
DROP TABLE IF EXISTS review_tasks CASCADE;
DROP TABLE IF EXISTS content_direction CASCADE;
```

Then run migrations again.

## 📚 Next Steps

Once tables are created:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **The API endpoints are ready:**
   - `POST /api/content/approve` - Director approval routing
   - `GET /api/content/review` - Review task management
   - `POST /api/content/performance` - Record metrics
   - `GET /api/content` - Dashboard data

3. **Test the workflow:**
   - Analyze a video clip (auto-runs director approval)
   - Check approval status in `/api/content`
   - View dashboard at `http://localhost:3000`

4. **Set up additional features:**
   - Webhook handlers for platform metrics (see `/CONTENT_MANAGEMENT_GUIDE.md`)
   - Cron job for weekly reports
   - Email notifications for approval notifications

## 📖 Learn More

- **Full operational guide:** See [/CONTENT_MANAGEMENT_GUIDE.md](/CONTENT_MANAGEMENT_GUIDE.md)
- **API reference:** See content management module imports in TypeScript files
- **Schema details:** See comments in each `.sql` migration file

## 🆘 Need Help?

Check the logs:
- **Supabase Dashboard:** Click database → inspect tables and indexes
- **Application:** Check `npm run dev` console output
- **API Responses:** Use Postman or curl to test endpoints

If stuck, review the database.md in your Supabase project settings for connection details.

---

**Status:** Migration setup complete ✅

Once tables are created, the content management, approval routing, and performance tracking systems are fully operational!
