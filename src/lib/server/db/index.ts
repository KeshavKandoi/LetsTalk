import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'
import { getDatabaseBinding } from '../env'

export const db = drizzle(getDatabaseBinding(), { schema })
