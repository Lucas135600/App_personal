import fs from "node:fs";
import path from "node:path";

/** O esquema mora em um .sql de verdade, não em string dentro do código:
 *  assim dá para abrir no editor do Postgres e conferir. */
export function schemaSql(): string {
  return fs.readFileSync(path.join(process.cwd(), "src", "lib", "schema.sql"), "utf8");
}
