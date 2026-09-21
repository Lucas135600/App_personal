import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, UPLOADS_DIR } from "./paths";

export { DATA_DIR, UPLOADS_DIR };

/* Utilitários que não dependem do banco.
   A leitura de dados vive em scope.ts (getDb) e repo.ts; as escritas em
   repo-write.ts. Este arquivo ficou só com o que é infraestrutura. */

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`lb360::${password}`).digest("hex");
}

/* Armazenamento de arquivos.
   Em desenvolvimento grava em data/uploads. Em produção isso vai para o
   Supabase Storage — disco de servidor serverless é efêmero e somente leitura. */

function ensureUploads() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function saveUpload(fileName: string, buffer: Buffer) {
  ensureUploads();
  fs.writeFileSync(path.join(UPLOADS_DIR, path.basename(fileName)), buffer);
}

export function readUpload(fileName: string): Buffer | null {
  const target = path.join(UPLOADS_DIR, path.basename(fileName));
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target);
}
