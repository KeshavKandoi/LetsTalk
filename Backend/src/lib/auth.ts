import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { username, bearer } from 'better-auth/plugins'
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
    'http://192.168.29.59:3000',
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [username(), tanstackStartCookies(), bearer()],
})
