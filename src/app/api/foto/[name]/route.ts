import { NextResponse } from "next/server";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { getDb, readUpload } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Fotos de evolução são dados sensíveis: só o próprio aluno e o personal
 *  responsável por ele podem ler o arquivo. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });

  const { name } = await ctx.params;
  const safe = path.basename(name);
  const db = getDb();
  const photo = db.progressPhotos.find((p) => p.fileName === safe);
  if (!photo) return new NextResponse("Não encontrado", { status: 404 });

  const student = db.students.find((s) => s.id === photo.studentId);
  if (!student) return new NextResponse("Não encontrado", { status: 404 });

  const allowed =
    (user.role === "student" && student.userId === user.id) ||
    (user.role === "personal" && student.professionalId === user.id);
  if (!allowed) return new NextResponse("Acesso negado", { status: 403 });

  const buffer = readUpload(safe);
  if (!buffer) return new NextResponse("Não encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": TYPES[path.extname(safe).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
