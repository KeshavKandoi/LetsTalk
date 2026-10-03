import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at ASC;`;
console.log('Applied migrations:');
console.table(rows);
process.exit(0);
