import { schemaSql } from "./schema-file";

/* Uma única porta de entrada para o banco.
 *
 * Em produção (DATABASE_URL definida) usa Postgres de verdade via `pg`.
 * Em desenvolvimento, sem nenhuma conta ou instalação, usa PGlite — o próprio
 * Postgres compilado em WASM. O SQL é o mesmo nos dois, então o que passa
 * aqui passa lá.
 */

export type Row = Record<string, unknown>;

export interface Driver {
  query<T extends Row>(text: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (q: Querier) => Promise<T>): Promise<T>;
  kind: "postgres" | "pglite";
}

export interface Querier {
  <T extends Row>(text: string, params?: unknown[]): Promise<T[]>;
}

const globalStore = globalThis as unknown as { __lbsql?: Promise<Driver> };

async function createPostgres(url: string): Promise<Driver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    // Supabase e Neon exigem TLS; o certificado é da cadeia deles, não própria.
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    max: 5,
  });

  return {
    kind: "postgres",
    async query<T extends Row>(text: string, params?: unknown[]) {
      const res = await pool.query(text, params);
      return res.rows as T[];
    },
    async transaction<T>(fn: (q: Querier) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const q: Querier = async <U extends Row>(text: string, params?: unknown[]) => {
          const res = await client.query(text, params);
          return res.rows as U[];
        };
        const out = await fn(q);
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) return createPostgres(url);

  // O `if` abaixo é resolvido na hora do build: em produção a comparação é
  // falsa e o ramo inteiro é descartado, levando junto o PGlite e o módulo de
  // dados de demonstração — que carrega senhas literais e não tem o que fazer
  // num servidor público. O que sobra lá é o erro, que é o comportamento certo:
  // sem banco configurado o app não deve subir fingindo que está inteiro.
  if (process.env.NODE_ENV !== "production") {
    const { createPglite } = await import("./sql-dev");
    return createPglite();
  }

  throw new Error(
    "DATABASE_URL ausente. Em produção o banco é obrigatório — defina a variável na hospedagem.",
  );
}

function driver(): Promise<Driver> {
  globalStore.__lbsql ??= connect();
  return globalStore.__lbsql;
}

/** Consulta simples. Sempre com parâmetros — nunca concatene SQL. */
export async function sql<T extends Row>(text: string, params?: unknown[]): Promise<T[]> {
  const d = await driver();
  return d.query<T>(text, params);
}

/** Primeira linha, ou null. */
export async function sqlOne<T extends Row>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}

/** Escritas que precisam ser atômicas (várias tabelas de uma vez). */
export async function transaction<T>(fn: (q: Querier) => Promise<T>): Promise<T> {
  const d = await driver();
  return d.transaction(fn);
}

/** Aplica o esquema. Usado pelo `npm run db:push` contra o banco de produção. */
export async function applySchema(): Promise<void> {
  const d = await driver();
  if (d.kind === "pglite") return; // o PGlite já aplica ao abrir
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(schemaSql());
  } finally {
    await client.end();
  }
}

export async function driverKind(): Promise<"postgres" | "pglite"> {
  return (await driver()).kind;
}
