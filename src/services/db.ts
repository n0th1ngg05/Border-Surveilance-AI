/**
 * src/services/db.ts
 * PostgreSQL connection pool with:
 *  - Connection retry with exponential backoff
 *  - Pool event error logging (won't crash the process)
 *  - Graceful shutdown via closeDB()
 *  - Typed query helper with error wrapping
 */

import pg from "pg";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../utils/errors.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

const POOL_CONFIG: pg.PoolConfig = {
  host:                  config.DB_HOST,
  port:                  config.DB_PORT,
  database:              config.DB_NAME,
  user:                  config.DB_USER,
  password:              config.DB_PASSWORD,
  max:                   20,
  idleTimeoutMillis:     30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle:       false,
};

export async function connectDB(retries = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      pool = new Pool(POOL_CONFIG);

      // Surface idle client errors — prevents silent pool poisoning
      pool.on("error", (err, client) => {
        logger.error({ err }, "Idle PostgreSQL client error");
      });

      // Validate the connection is actually alive
      const client = await pool.connect();
      const { rows } = await client.query<{ now: Date }>("SELECT NOW() AS now");
      client.release();

      logger.info({ serverTime: rows[0]?.now }, "PostgreSQL connection verified");
      return;
    } catch (err) {
      logger.warn({ err, attempt, retries }, "PostgreSQL connection attempt failed");

      if (attempt === retries) {
        throw new ServiceUnavailableError(`PostgreSQL after ${retries} attempts`);
      }

      const backoff = delayMs * 2 ** (attempt - 1);
      logger.info(`Retrying PostgreSQL in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function getDB(): pg.Pool {
  if (!pool) {
    throw new ServiceUnavailableError("PostgreSQL (not initialised — boot order issue)");
  }
  return pool;
}

/**
 * Execute a parameterised SQL query.
 * Wraps pg errors with context so logs are actionable.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  const db = getDB();
  try {
    return await db.query<T>(sql, values);
  } catch (err) {
    logger.error({ err, sql: sql.slice(0, 120), values }, "Database query failed");
    throw err; // re-throw — let the controller/service decide how to handle
  }
}

/**
 * Run multiple queries in a single transaction.
 * Automatically rolls back on any error.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDB().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Transaction rolled back");
    throw err;
  } finally {
    client.release();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
