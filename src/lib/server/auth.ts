import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from './db'
import * as schema from './db/schema'
import { getAppBaseUrl, getAuthSecret } from './env'

export const auth = betterAuth({
  secret: getAuthSecret(),
  baseURL: getAppBaseUrl(),
  basePath: '/api/auth',
  trustedOrigins: [
    getAppBaseUrl(),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username(), tanstackStartCookies()],
})
