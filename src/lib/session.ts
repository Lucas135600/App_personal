import crypto from "node:crypto";

/* Assinatura do cookie de sessão, num lugar só.
 *
 * Em produção o segredo é obrigatório e a aplicação se recusa a subir sem ele.
 * O valor de desenvolvimento é público neste repositório — quem o lê consegue
 * forjar o cookie de qualquer usuário, inclusive o do personal. Subir com ele
 * seria deixar a porta destrancada, então falhamos alto em vez de baixo. */

export const SESSION_COOKIE = "lb_session";

function secret(): string {
  const fromEnv = process.env.LB_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "LB_SESSION_SECRET ausente ou curta demais. Defina uma chave de pelo menos 16 caracteres " +
        'antes de subir: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return "lb360-dev-secret";
}

export function signSession(userId: string): string {
  const mac = crypto.createHmac("sha256", secret()).update(userId).digest("hex").slice(0, 32);
  return `${userId}.${mac}`;
}

export function verifySession(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const esperado = Buffer.from(signSession(userId));
  const recebido = Buffer.from(token);
  if (esperado.length !== recebido.length) return null;
  return crypto.timingSafeEqual(esperado, recebido) ? userId : null;
}
