import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildStudentView } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import { Card, LinkButton, Stat } from "@/components/ui";

export default async function WorkoutDonePage({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent();
  const { id } = await params;
  const db = getDb();
  const view = buildStudentView(student.id)!;

  const session = db.workoutSessions
    .filter((s) => s.studentId === student.id && s.workoutId === id && s.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const sets = session ? db.workoutSets.filter((s) => s.sessionId === session.id) : [];
  const volume = sets.reduce((acc, s) => acc + s.load * s.reps, 0);

  const streak = (() => {
    let n = 0;
    const dates = new Set(
      db.workoutSessions
        .filter((s) => s.studentId === student.id && s.finishedAt)
        .map((s) => s.startedAt.slice(0, 10)),
    );
    const d = new Date(`${todayISO()}T12:00:00`);
    for (let i = 0; i < 60; i++) {
      const iso = d.toISOString().slice(0, 10);
      if (dates.has(iso)) n++;
      else if (i > 0 && n > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  })();

  return (
    <div className="space-y-5 lb-enter">
      <Card className="text-center">
        <p className="text-4xl">&#x2714;</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Treino concluído</h1>
        <p className="mt-1 text-sm text-ink-400">
          Seu personal já recebeu o registro deste treino.
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Séries" value={sets.length} />
        <Stat label="Volume" value={`${Math.round(volume).toLocaleString("pt-BR")}`} sub="kg levantados" />
        <Stat label="Sequência" value={streak} sub="treinos seguidos" tone="accent" />
      </div>

      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">Sua semana</p>
        <p className="mt-2 text-sm text-ink-300">
          {view.doneLast4Weeks} treinos nas últimas 4 semanas &middot; frequência {view.frequency}%
        </p>
        {view.currentCheckin?.status !== "respondido" && (
          <LinkButton href="/aluno/checkin" variant="ghost" size="lg" className="mt-4">
            Responder check-in da semana
          </LinkButton>
        )}
      </Card>

      <LinkButton href="/aluno" size="lg">
        Voltar para o início
      </LinkButton>
    </div>
  );
}
