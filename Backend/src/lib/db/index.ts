import '../load-env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema'
import path from 'path'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL in .env')

const client = postgres(url, { ssl: 'require' })
export const db = drizzle(client, { schema })

// Auto-migrate on startup
const migrationClient = postgres(url, { ssl: 'require', max: 1 })
migrate(drizzle(migrationClient), {
  migrationsFolder: path.join(process.cwd(), 'drizzle'),
}).catch((e) => {
  console.warn('[db] Migration warning:', e.message)
})
