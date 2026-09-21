/* Aplica src/lib/schema.sql no banco apontado por DATABASE_URL.
   Use uma vez, ao criar o banco no Supabase:  npm run db:push
   O esquema é idempotente (CREATE TABLE IF NOT EXISTS), então repetir não quebra. */
import fs from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Coloque-a em .env.local ou no ambiente.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(fs.readFileSync("src/lib/schema.sql", "utf8"));
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log(`esquema aplicado — ${rows.length} tabelas:`);
  for (const r of rows) console.log("  " + r.table_name);
} finally {
  await client.end();
}
