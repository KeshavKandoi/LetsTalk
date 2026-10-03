import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
try {
  console.log("Checking public.__drizzle_migrations...");
  const pub = await sql`SELECT * FROM public.__drizzle_migrations ORDER BY created_at ASC;`;
  console.table(pub);
} catch(e) { console.error("Not in public"); }
try {
  console.log("Checking drizzle.__drizzle_migrations...");
  const d = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at ASC;`;
  console.table(d);
} catch(e) { console.error("Not in drizzle"); }
process.exit(0);
