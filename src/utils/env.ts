import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const ENV = {
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  OPENAI_PROJECT_ID: process.env.OPENAI_PROJECT_ID || '',
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
  PIXABAY_USERNAME: process.env.PIXABAY_USERNAME || '',
  QUIET_HOURS_API_URL: process.env.QUIET_HOURS_API_URL || '',
  QUIET_HOURS_API_KEY: process.env.QUIET_HOURS_API_KEY || '',
};
