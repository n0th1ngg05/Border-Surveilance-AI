/**
 * src/config/index.ts
 * Centralised, validated environment config.
 * All env vars are read ONCE here — nowhere else in the codebase.
 */

import { z } from "zod";

const envSchema = z.object({
  // Server & Demo Mode
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DEMO_MODE: z.coerce.boolean().default(true),

  // PostgreSQL
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("border-surveilance"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // MQTT
  MQTT_BROKER_URL: z.string().default("mqtt://localhost:1883"),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),

  // Python AI runtime
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),

  // JWT
  JWT_SECRET: z.string().min(16).default("sih26187_super_secret_jwt_key_2026"),
  JWT_EXPIRES_IN: z.string().default("24h"),

  // MinIO
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default("sih26187-snapshots"),

  // Logging
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
