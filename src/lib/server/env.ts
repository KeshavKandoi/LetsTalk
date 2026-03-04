import { env } from 'cloudflare:workers'

type AppEnv = Cloudflare.Env & {
  BETTER_AUTH_SECRET?: string
  DB?: D1Database
}

const appEnv = env as AppEnv

export function getAuthSecret() {
  const secret = appEnv.BETTER_AUTH_SECRET

  if (!secret) {
    throw new Error(
      'Missing BETTER_AUTH_SECRET. Add it to .dev.vars for local development and set it as a Wrangler secret before deploying.',
    )
  }

  return secret
}

export function getDatabaseBinding() {
  const database = appEnv.DB

  if (!database) {
    throw new Error(
      'Missing the DB D1 binding. Add the D1 database binding in wrangler.jsonc before starting the app.',
    )
  }

  return database
}
