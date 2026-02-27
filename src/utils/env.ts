const optional = (key: string, fallback = ''): string => {
  return process.env[key] || fallback;
};

export const ENV = {
  SUPABASE_URL: optional('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: optional('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY'),
  OPENAI_PROJECT_ID: optional('OPENAI_PROJECT_ID'),
  PEXELS_API_KEY: optional('PEXELS_API_KEY'),
  PIXABAY_USERNAME: optional('PIXABAY_USERNAME'),
  QUIET_HOURS_API_URL: optional('QUIET_HOURS_API_URL'),
  QUIET_HOURS_API_KEY: optional('QUIET_HOURS_API_KEY'),
};
