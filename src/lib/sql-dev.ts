import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";
import { schemaSql } from "./schema-file";
import type { Driver, Querier, Row } from "./sql";

/* Banco de desenvolvimento: PGlite, o próprio Postgres compilado em WASM,
 * gravando em data/pg. Nenhuma instalação, nenhuma conta, e o mesmo SQL do
 * Postgres de produção.
 *
 * Este arquivo vive separado de sql.ts de propósito. Ele é carregado por um
 * import() dentro de um `if` que o empacotador resolve na hora do build, então
 * em produção o ramo inteiro some — e com ele o PGlite e os dados de
 * demonstração, que incluem senhas literais que não têm o que fazer num
 * servidor público.
 */
export async function createPglite(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new PGlite(path.join(DATA_DIR, "pg"));
  await db.waitReady;
  await db.exec(schemaSql());

  const driver: Driver = {
    kind: "pglite",
    async query<T extends Row>(text: string, params?: unknown[]) {
      const res = await db.query(text, params);
      return res.rows as T[];
    },
    async transaction<T>(fn: (q: Querier) => Promise<T>) {
      return db.transaction(async (tx) => {
        const q: Querier = async <U extends Row>(text: string, params?: unknown[]) => {
          const res = await tx.query(text, params);
          return res.rows as U[];
        };
        return fn(q);
      }) as Promise<T>;
    },
  };

  // Base nova em desenvolvimento nasce com os dados de demonstração.
  const [{ count }] = await driver.query<{ count: string }>("SELECT count(*) FROM users");
  if (Number(count) === 0) {
    const { seedDatabase } = await import("./seed-sql");
    await seedDatabase(driver.query.bind(driver));
  }

  return driver;
}
