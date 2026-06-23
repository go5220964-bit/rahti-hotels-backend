import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Ensure env variables are loaded
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl.includes('connection_limit')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}connection_limit=5`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
  log: ['info', 'warn', 'error'],
});

export default prisma;
