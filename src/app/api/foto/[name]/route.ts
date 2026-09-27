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

/* Duas origens de foto, com regras de acesso deliberadamente diferentes:
 *
 * - Evolução: foto de corpo. Só o próprio aluno e o personal dele. Ninguém mais,
 *   nunca.
 * - Validação de desafio: o aluno enviou justamente para os adversários verem.
 *   Abre para quem aceitou aquele desafio, e para o personal.
 *
 * A separação é por tabela, não por nome de arquivo: nome é palpite, tabela é
 * fato. Arquivo que não está em nenhuma das duas não existe para esta rota.
 */
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

  let allowed = false;

  if (dono) {
    allowed =
      (user.role === "student" && dono.user_id === user.id) ||
      (user.role === "personal" && dono.professional_id === user.id);
  } else {
    const entrada = await sqlOne<{ challenge_id: string; user_id: string; professional_id: string }>(
      `SELECT ce.challenge_id, st.user_id, ch.professional_id
         FROM challenge_entries ce
         JOIN students st ON st.id = ce.student_id
         JOIN challenges ch ON ch.id = ce.challenge_id
        WHERE ce.photo_file_name = $1`,
      [safe],
    );
    if (!entrada) return new NextResponse("Não encontrado", { status: 404 });

    if (user.role === "personal") {
      allowed = entrada.professional_id === user.id;
    } else {
      // participante aceito do mesmo desafio — inclui o próprio autor
      const membro = await sqlOne(
        `SELECT 1 AS x
           FROM challenge_members cm JOIN students st ON st.id = cm.student_id
          WHERE cm.challenge_id = $1 AND st.user_id = $2 AND cm.status = 'aceito'`,
        [entrada.challenge_id, user.id],
      );
      allowed = membro !== null;
    }
  }

  if (!allowed) return new NextResponse("Acesso negado", { status: 403 });

  const buffer = await readPhoto(safe);
  if (!buffer) return new NextResponse("Não encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": TYPES[path.extname(safe).toLowerCase()] ?? "application/octet-stream",
      /* Nada de cache, e o motivo não é desempenho.
         "private" é cache do navegador, não cache por usuário: com max-age, um
         aparelho compartilhado entrega a imagem de quem entrou antes para quem
         entra depois, sem passar por esta rota e sem verificar nada. Em foto de
         corpo e comprovação de desafio, isso é vazamento. O custo é rebaixar a
         imagem a cada visita, e vale. */
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Vary: "Cookie",
    },
  });
}
