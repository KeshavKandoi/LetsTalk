import '../load-env'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL in .env')

const client = postgres(url, { ssl: 'require' })
export const db = drizzle(client, { schema })
