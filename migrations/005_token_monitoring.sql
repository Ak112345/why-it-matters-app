-- Token Health Monitoring Tables
-- Tracks token expiration and health status

-- Token health log (upsert on each check)
CREATE TABLE IF NOT EXISTS token_health_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  token_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'expired', 'unknown')),
  expires_at TIMESTAMPTZ,
  days_until_expiry INTEGER,
  message TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, token_type)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_token_health_platform ON token_health_log(platform);
CREATE INDEX IF NOT EXISTS idx_token_health_status ON token_health_log(status);
CREATE INDEX IF NOT EXISTS idx_token_health_checked_at ON token_health_log(checked_at DESC);

-- System alerts table (if not exists)
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  platform TEXT,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_platform ON system_alerts(platform);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged ON system_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE token_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on token_health_log"
  ON token_health_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on system_alerts"
  ON system_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon read access for monitoring dashboard
CREATE POLICY "Public read access on token_health_log"
  ON token_health_log
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public read access on system_alerts"
  ON system_alerts
  FOR SELECT
  TO anon
  USING (true);

-- Comments
COMMENT ON TABLE token_health_log IS 'Tracks platform token health and expiration status';
COMMENT ON TABLE system_alerts IS 'System-wide alerts for critical issues like token expiration';
