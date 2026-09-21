import { NextResponse } from "next/server";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { readPhoto } from "@/lib/storage";
import { sqlOne } from "@/lib/sql";

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
  // consulta direta: a foto precisa ser resolvida mesmo fora do escopo da sessão
  const dono = await sqlOne<{ user_id: string; professional_id: string }>(
    `SELECT st.user_id, st.professional_id
       FROM progress_photos ph JOIN students st ON st.id = ph.student_id
      WHERE ph.file_name = $1`,
    [safe],
  );
  if (!dono) return new NextResponse("Não encontrado", { status: 404 });

  const allowed =
    (user.role === "student" && dono.user_id === user.id) ||
    (user.role === "personal" && dono.professional_id === user.id);
  if (!allowed) return new NextResponse("Acesso negado", { status: 403 });

  const buffer = await readPhoto(safe);
  if (!buffer) return new NextResponse("Não encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": TYPES[path.extname(safe).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
