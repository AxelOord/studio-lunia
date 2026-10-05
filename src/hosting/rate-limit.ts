import { createHmac } from 'node:crypto'
import { Pool } from 'pg'
import { APIError } from 'payload'
let pool: Pool | undefined

// PostgreSQL atomic upsert works across serverless instances. No raw email/IP is stored.
export async function limitOperation(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds = 900,
) {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
  })
  const key = createHmac('sha256', process.env.PAYLOAD_SECRET!)
    .update(`${scope}:${identity}`)
    .digest('hex')
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO lunia_rate_limits (key, attempts, expires_at) VALUES ($1, 1, now() + $2 * interval '1 second')
     ON CONFLICT (key) DO UPDATE SET
       attempts = CASE WHEN lunia_rate_limits.expires_at <= now() THEN 1 ELSE lunia_rate_limits.attempts + 1 END,
       expires_at = CASE WHEN lunia_rate_limits.expires_at <= now() THEN now() + $2 * interval '1 second' ELSE lunia_rate_limits.expires_at END
     RETURNING attempts`,
    [key, windowSeconds],
  )
  await pool.query("DELETE FROM lunia_rate_limits WHERE expires_at < now() - interval '1 hour'")
  if (result.rows[0].attempts > limit)
    throw new APIError('Too many requests. Please try again later.', 429)
}
