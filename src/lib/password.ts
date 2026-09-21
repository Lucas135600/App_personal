import crypto from "node:crypto";

/* Senhas com scrypt.
 *
 * SHA-256 sem sal — o que este projeto usava — é rápido demais: uma GPU testa
 * bilhões por segundo, e um vazamento do banco viraria lista de senhas em
 * minutos. scrypt é deliberadamente lento e exige memória, o que derruba o
 * ganho de paralelizar em GPU.
 *
 * Formato: scrypt$N$r$p$sal$hash (tudo em hex), para que trocar os parâmetros
 * no futuro não invalide as senhas já gravadas.
 */

const N = 16384; // custo de CPU/memória — ~16 MB por verificação
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Formato antigo: 64 caracteres hex, sem sal. Mantido só para migrar. */
const LEGADO = /^[0-9a-f]{64}$/i;

function legacyHash(password: string): string {
  return crypto.createHash("sha256").update(`lb360::${password}`).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export interface ResultadoSenha {
  ok: boolean;
  /** true quando a senha confere mas está no formato antigo e deve ser regravada. */
  precisaAtualizar: boolean;
}

export function verifyPassword(password: string, stored: string): ResultadoSenha {
  if (!stored) return { ok: false, precisaAtualizar: false };

  if (LEGADO.test(stored)) {
    const esperado = Buffer.from(stored, "hex");
    const recebido = Buffer.from(legacyHash(password), "hex");
    const ok = esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
    return { ok, precisaAtualizar: ok };
  }

  const partes = stored.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return { ok: false, precisaAtualizar: false };

  const [, n, r, p, saltHex, hashHex] = partes;
  const salt = Buffer.from(saltHex, "hex");
  const esperado = Buffer.from(hashHex, "hex");

  let derived: Buffer;
  try {
    derived = crypto.scryptSync(password, salt, esperado.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
  } catch {
    return { ok: false, precisaAtualizar: false };
  }

  const ok = esperado.length === derived.length && crypto.timingSafeEqual(esperado, derived);
  // parâmetros antigos também pedem regravação
  const desatualizado = Number(n) !== N || Number(r) !== R || Number(p) !== P;
  return { ok, precisaAtualizar: ok && desatualizado };
}
