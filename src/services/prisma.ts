import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Ensure env variables are loaded
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['info', 'warn', 'error'],
});

export default prisma;
