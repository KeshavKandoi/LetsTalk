import '../load-env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema'
import path from 'path'
import { fileURLToPath } from 'url'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL in .env')

const client = postgres(url, { ssl: 'require' })
export const db = drizzle(client, { schema })

// Auto-migrate on startup
const migrationClient = postgres(url, { ssl: 'require', max: 1 })
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../drizzle',
)
migrate(drizzle(migrationClient), {
  migrationsFolder,
}).catch((e) => {
  console.warn('[db] Migration warning:', e.message)
})
