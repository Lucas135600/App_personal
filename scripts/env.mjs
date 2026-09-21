import fs from "node:fs";

/** Carrega .env.local para os scripts avulsos.
 *  O Next faz isso sozinho; `node scripts/...` não. */
export function loadEnv(file = ".env.local") {
  if (!fs.existsSync(file)) return;
  for (const linha of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const chave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}
