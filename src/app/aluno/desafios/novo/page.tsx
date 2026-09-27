import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { Card } from "@/components/ui";
import { CreateChallengeForm, type Convidavel } from "./create-form";

export default async function NewChallengePage() {
  const { student } = await requireStudent();
  const db = await getDb();

  /* Só entram na lista alunos ativos do mesmo personal, com perfil público, e
     nunca o próprio. A ação confere isto de novo no servidor — esta lista é
     conveniência, não segurança. */
  const candidatos: Convidavel[] = db.students
    .filter(
      (s) =>
        s.professionalId === student.professionalId &&
        s.status === "ativo" &&
        s.publicProfile &&
        s.id !== student.id,
    )
    .map((s) => {
      const u = db.users.find((x) => x.id === s.userId);
      return {
        studentId: s.id,
        nome: u?.name ?? "Aluno",
        avatarColor: u?.avatarColor ?? "#9aa1ac",
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const euSouPublico = student.publicProfile;

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <Link href="/aluno/desafios" className="text-xs font-semibold text-ink-400">
          ← Desafios
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Novo desafio</h1>
      </header>

      {/* Regra simétrica: quem não se mostra não garimpa os outros. */}
      {!euSouPublico && (
        <Card>
          <p className="text-sm font-semibold text-ink-100">Seu perfil está oculto</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-400">
            Para convidar alguém você também precisa aparecer na lista dos outros. É a
            mesma regra para todo mundo: quem não se mostra não vê quem está disponível.
          </p>
          <Link
            href="/aluno/perfil"
            className="mt-3 inline-block text-sm font-semibold text-lime-accent"
          >
            Tornar meu perfil visível
          </Link>
        </Card>
      )}

      {euSouPublico && <CreateChallengeForm candidatos={candidatos} />}
    </div>
  );
}
