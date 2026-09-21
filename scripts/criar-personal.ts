/* Cria a primeira conta de personal no banco de produção.
 *
 *   npm run criar:personal
 *
 * A senha é digitada aqui no terminal e some da memória depois de virar hash.
 * Ela não aparece na tela, não fica no histórico do shell e não é gravada em
 * arquivo nenhum — por isso este script pede em vez de aceitar por argumento.
 */
import readline from "node:readline";
import crypto from "node:crypto";
import pg from "pg";
import { hashPassword } from "../src/lib/password.ts";
import { loadEnv } from "./env.mjs";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Preencha o .env.local.");
  process.exit(1);
}

function pergunta(texto: string, escondido = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (escondido) {
    const i = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    const original = i._writeToOutput.bind(rl);
    i._writeToOutput = (s: string) => {
      // deixa passar o texto da pergunta; esconde o que for digitado
      if (s.includes(texto)) original(s);
      else i.output.write("*");
    };
  }

  return new Promise((resolve) => {
    rl.question(texto, (resposta) => {
      if (escondido) process.stdout.write("\n");
      rl.close();
      resolve(resposta.trim());
    });
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CORES = ["#c8f542", "#4ade80", "#38bdf8", "#a78bfa", "#fbbf24"];

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows: existentes } = await client.query(
    "SELECT email FROM users WHERE role = 'personal' ORDER BY created_at",
  );

  if (existentes.length > 0 && !process.argv.includes("--mais-um")) {
    console.log("Já existe conta de personal neste banco:");
    for (const e of existentes) console.log(`  ${e.email}`);
    console.log("\nPara criar outra mesmo assim: npm run criar:personal -- --mais-um");
    process.exit(0);
  }

  console.log("Criando conta de personal.\n");
  const name = await pergunta("Nome: ");
  const email = (await pergunta("E-mail: ")).toLowerCase();
  const senha = await pergunta("Senha: ", true);
  const confirma = await pergunta("Confirme a senha: ", true);

  if (!name) throw new Error("Nome vazio.");
  if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
  if (senha.length < 8) throw new Error("Use pelo menos 8 caracteres — esta conta vê dados de saúde de terceiros.");
  if (senha !== confirma) throw new Error("As senhas não conferem.");

  const { rows: jaTem } = await client.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
  if (jaTem.length > 0) throw new Error("Já existe usuário com este e-mail.");

  const id = `pro_${crypto.randomBytes(6).toString("hex")}`;
  await client.query(
    `INSERT INTO users (id, email, password_hash, name, role, professional_id, avatar_color, created_at)
     VALUES ($1, $2, $3, $4, 'personal', NULL, $5, CURRENT_DATE)`,
    [id, email, hashPassword(senha), name, CORES[0]],
  );

  console.log(`\nConta criada: ${name} <${email}>`);
  console.log("Entre no app com esse e-mail e cadastre seus alunos por lá.");
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
