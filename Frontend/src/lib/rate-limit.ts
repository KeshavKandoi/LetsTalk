import { db } from '@backend/lib/db'
import { sql } from 'drizzle-orm'

const TABLE_SQL = sql`CREATE TABLE IF NOT EXISTS api_rate_limit (
  key text PRIMARY KEY,
  count integer NOT NULL,
  window_started timestamptz NOT NULL
)`

export function clientAddress(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function enforceRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number, identity?: string) {
  await db.execute(TABLE_SQL)
  const key = `${bucket}:${identity || clientAddress(request)}`
  const result = await db.execute(sql`
    INSERT INTO api_rate_limit (key, count, window_started)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN api_rate_limit.window_started <= now() - (${windowSeconds} * interval '1 second') THEN 1 ELSE api_rate_limit.count + 1 END,
      window_started = CASE WHEN api_rate_limit.window_started <= now() - (${windowSeconds} * interval '1 second') THEN now() ELSE api_rate_limit.window_started END
    RETURNING count
  `) as unknown as Array<{ count: number }>
  if (Number(result[0]?.count || 0) <= limit) return null
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(windowSeconds) },
  })
}
