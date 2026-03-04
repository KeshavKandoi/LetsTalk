import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from './db'
import * as schema from './db/schema'
import { getAuthSecret } from './env'

export const auth = betterAuth({
  secret: getAuthSecret(),
  basePath: '/api/auth',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username(), tanstackStartCookies()],
})
