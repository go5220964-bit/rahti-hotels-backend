import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

export interface Environment {
  PORT: number;
  DATABASE_URL: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_API_TOKEN: string;
}

const getEnv = (): Environment => {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
  const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'super-secret-verify-token-123';
  const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || 'mock-whatsapp-api-token';

  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL is not set in environment, defaulting to SQLite: "file:./dev.db"');
  }

  return {
    PORT,
    DATABASE_URL,
    WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_API_TOKEN,
  };
};

export const env = getEnv();
export default env;
