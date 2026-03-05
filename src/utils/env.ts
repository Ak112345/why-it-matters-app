const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optional = (key: string, fallback = ''): string => {
  return process.env[key] || fallback;
};

export const ENV = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  OPENAI_PROJECT_ID: optional('OPENAI_PROJECT_ID'),
  PEXELS_API_KEY: optional('PEXELS_API_KEY'),
  PIXABAY_USERNAME: optional('PIXABAY_USERNAME'),
  PIXABAY_API_KEY: optional('PIXABAY_API_KEY'),
  QUIET_HOURS_API_URL: optional('QUIET_HOURS_API_URL'),
  QUIET_HOURS_API_KEY: optional('QUIET_HOURS_API_KEY'),
  RAILWAY_WORKER_URL: required('RAILWAY_WORKER_URL'),
  WORKER_SECRET: required('WORKER_SECRET'),
};