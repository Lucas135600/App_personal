import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "./paths";

/* Armazenamento das fotos de evolução.
 *
 * Em desenvolvimento grava em data/uploads. Em produção vai para o Supabase
 * Storage, porque disco de servidor serverless é efêmero e somente leitura.
 *
 * O bucket é PRIVADO de propósito. A foto nunca é servida por URL pública nem
 * por link assinado: quem decide se a imagem pode ser vista é a rota
 * /api/foto, que valida a sessão. Link assinado vazaria se fosse copiado —
 * este é dado de saúde, e o portão tem que ficar na nossa mão.
 */

const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || "fotos-evolucao";

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { base: `${url.replace(/\/$/, "")}/storage/v1/object`, key };
}

function safeName(fileName: string) {
  return path.basename(fileName);
}

export async function putPhoto(fileName: string, body: Buffer, contentType: string): Promise<void> {
  const name = safeName(fileName);
  const sb = supabase();

  if (!sb) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, name), body);
    return;
  }

  const res = await fetch(`${sb.base}/${BUCKET}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sb.key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    throw new Error(`Falha ao guardar a foto (${res.status}). Verifique o bucket "${BUCKET}".`);
  }
}

export async function readPhoto(fileName: string): Promise<Buffer | null> {
  const name = safeName(fileName);
  const sb = supabase();

  if (!sb) {
    const target = path.join(UPLOADS_DIR, name);
    return fs.existsSync(target) ? fs.readFileSync(target) : null;
  }

  const res = await fetch(`${sb.base}/${BUCKET}/${name}`, {
    headers: { Authorization: `Bearer ${sb.key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function deletePhoto(fileName: string): Promise<void> {
  const name = safeName(fileName);
  const sb = supabase();

  if (!sb) {
    const target = path.join(UPLOADS_DIR, name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return;
  }

  await fetch(`${sb.base}/${BUCKET}/${name}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sb.key}` },
  });
}

/** Onde as fotos estão indo agora — usado para avisar no ambiente errado. */
export function storageKind(): "supabase" | "disco" {
  return supabase() ? "supabase" : "disco";
}
