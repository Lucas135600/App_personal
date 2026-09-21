/* Confere se o ambiente do Supabase está completo e funcionando.
 *
 *   npm run supabase:check
 *
 * Nunca imprime segredo: mostra só o começo de cada chave, o suficiente para
 * você reconhecer qual colou.
 */
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();

let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log(`${c ? "  ok  " : " FALHA"} ${m}`); };
const mascara = (v) => (v ? `${v.slice(0, 8)}…(${v.length} chars)` : "vazio");

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB = process.env.DATABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || "fotos-evolucao";
const SESSION = process.env.LB_SESSION_SECRET;

console.log("— variáveis");
ok(Boolean(URL_SB), `NEXT_PUBLIC_SUPABASE_URL: ${URL_SB || "vazia"}`);
ok(Boolean(DB), `DATABASE_URL: ${mascara(DB)}`);
ok(Boolean(KEY), `SUPABASE_SERVICE_ROLE_KEY: ${mascara(KEY)}`);
ok(Boolean(SESSION) && SESSION.length >= 16, `LB_SESSION_SECRET: ${mascara(SESSION)}`);

if (DB) {
  console.log("\n— banco");
  if (!DB.includes(":6543")) {
    console.log("  aviso  a porta não é 6543; em serverless use a do pooler");
  }
  const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows: [v] } = await client.query("SELECT version() AS v");
    ok(true, `conectou — ${v.v.split(",")[0]}`);

    const { rows: t } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
    );
    if (t.length === 0) {
      ok(false, "nenhuma tabela — rode: npm run db:push");
    } else {
      ok(t.length >= 15, `${t.length} tabelas criadas`);
      const { rows: [u] } = await client.query("SELECT count(*)::int AS n FROM users");
      console.log(`  info  ${u.n} usuários no banco${u.n === 0 ? " (vazio, pronto para o primeiro cadastro)" : ""}`);
    }
  } catch (e) {
    ok(false, `não conectou: ${e.message.slice(0, 90)}`);
  } finally {
    await client.end().catch(() => {});
  }
}

if (URL_SB && KEY) {
  console.log("\n— storage das fotos");
  const base = `${URL_SB.replace(/\/$/, "")}/storage/v1`;
  const auth = { Authorization: `Bearer ${KEY}` };

  try {
    const res = await fetch(`${base}/bucket`, { headers: auth });
    if (!res.ok) {
      ok(false, `API de storage respondeu ${res.status} — a service_role está certa?`);
    } else {
      const buckets = await res.json();
      const alvo = buckets.find((b) => b.name === BUCKET);
      ok(Boolean(alvo), alvo ? `bucket "${BUCKET}" existe` : `bucket "${BUCKET}" NÃO existe — crie no painel`);
      if (alvo) {
        ok(alvo.public === false, alvo.public
          ? `bucket está PÚBLICO — deixe privado, são fotos de corpo`
          : "bucket está privado, como deve ser");

        // ida e volta de verdade: grava, lê e apaga
        const nome = `verificacao-${Date.now()}.txt`;
        const corpo = "teste de escrita do LB Personal Trainner";
        const up = await fetch(`${base}/object/${BUCKET}/${nome}`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "text/plain", "x-upsert": "true" },
          body: corpo,
        });
        ok(up.ok, `gravou um arquivo de teste (${up.status})`);

        if (up.ok) {
          const down = await fetch(`${base}/object/${BUCKET}/${nome}`, { headers: auth, cache: "no-store" });
          const lido = down.ok ? await down.text() : "";
          ok(lido === corpo, "leu de volta o mesmo conteúdo");

          const anon = await fetch(`${base}/object/public/${BUCKET}/${nome}`);
          ok(!anon.ok, `sem autenticação o arquivo não abre (${anon.status})`);

          const del = await fetch(`${base}/object/${BUCKET}/${nome}`, { method: "DELETE", headers: auth });
          ok(del.ok, "apagou o arquivo de teste");
        }
      }
    }
  } catch (e) {
    ok(false, `storage inacessível: ${e.message.slice(0, 90)}`);
  }
}

console.log(falhas === 0 ? "\ntudo pronto para publicar" : `\n${falhas} item(ns) para resolver`);
process.exit(falhas === 0 ? 0 : 1);
