import crypto from "node:crypto";
import { DATA_DIR, UPLOADS_DIR } from "./paths";

export { DATA_DIR, UPLOADS_DIR };
export { hashPassword, verifyPassword } from "./password";

/* Utilitários que não dependem do banco.
   A leitura de dados vive em scope.ts (getDb) e repo.ts; as escritas em
   repo-write.ts. Este arquivo ficou só com o que é infraestrutura. */

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}
