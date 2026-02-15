import dotenv from 'dotenv';

dotenv.config();

/** Application configuration parsed from environment variables */
export const config = {
  /** PostgreSQL connection string for the registry database */
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/flyway_manager',
  /** HTTP server port */
  port: parseInt(process.env.PORT || '3000', 10),
  /** Node environment */
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
