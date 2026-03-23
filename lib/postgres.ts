import { Pool, type QueryResult, type QueryResultRow } from 'pg'
import { debugWarn } from '@/lib/log'
import { POSTGRES_SCHEMA_SQL } from '@/lib/postgres-schema'

declare global {
  // eslint-disable-next-line no-var
  var __heresPgPool: Pool | undefined
  // eslint-disable-next-line no-var
  var __heresPgSchemaReady: Promise<void> | undefined
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || ''
}

export function isPostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl())
}

export function getPgPool(): Pool | null {
  const connectionString = getDatabaseUrl()
  if (!connectionString) return null

  if (!globalThis.__heresPgPool) {
    globalThis.__heresPgPool = new Pool({
      connectionString,
      max: 5,
      ssl:
        connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
          ? false
          : { rejectUnauthorized: false },
    })
  }

  return globalThis.__heresPgPool
}

export async function ensurePostgresSchema(): Promise<void> {
  const pool = getPgPool()
  if (!pool) return

  if (!globalThis.__heresPgSchemaReady) {
    globalThis.__heresPgSchemaReady = (async () => {
      await pool.query(POSTGRES_SCHEMA_SQL)
    })().catch((error) => {
      globalThis.__heresPgSchemaReady = undefined
      throw error
    })
  }

  await globalThis.__heresPgSchemaReady
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const pool = getPgPool()
  if (!pool) {
    throw new Error('DATABASE_URL is not configured')
  }

  await ensurePostgresSchema()
  return await pool.query<T>(text, params)
}

export async function safePgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T> | null> {
  try {
    return await pgQuery<T>(text, params)
  } catch (error) {
    debugWarn('[postgres] query failed', error)
    return null
  }
}
