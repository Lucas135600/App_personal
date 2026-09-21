import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { activePlanWorkouts, resolveWorkout } from "@/lib/queries";
import { formatDate, WEEKDAY_LABELS } from "@/lib/dates";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";

export default async function StudentWorkoutsPage() {
  const { student } = await requireStudent();
  const { planName, workouts } = activePlanWorkouts(student.id);
  const db = getDb();

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meus treinos</h1>
        {planName && <p className="mt-1 text-sm text-ink-400">{planName}</p>}
      </header>

      {workouts.length === 0 ? (
        <EmptyState title="Nenhum treino prescrito" description="Assim que o Lucas montar seu bloco ele aparece aqui." />
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const resolved = resolveWorkout(w.id, student.id)!;
            const last = db.workoutSessions
              .filter((s) => s.studentId === student.id && s.workoutId === w.id && s.finishedAt)
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
            return (
              <Link key={w.id} href={`/aluno/treinos/${w.id}`} className="block">
                <Card className="transition-colors hover:border-ink-600">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-accent/15 text-lg font-bold text-lime-accent">
                      {w.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-bold">{w.name}</h2>
                      <p className="text-xs text-ink-400">
                        {resolved.items.length} exercícios &middot; {resolved.totalSets} séries &middot; ~{w.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {w.weekdays.map((d) => (
                      <Badge key={d} tone="neutral">{WEEKDAY_LABELS[d]}</Badge>
                    ))}
                    <span className="text-xs text-ink-500">
                      {last ? `último em ${formatDate(last.startedAt)}` : "ainda não realizado"}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <section>
        <SectionTitle>Histórico recente</SectionTitle>
        <ul className="space-y-2">
          {db.workoutSessions
            .filter((s) => s.studentId === student.id && s.finishedAt)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .slice(0, 8)
            .map((s) => {
              const w = db.workouts.find((x) => x.id === s.workoutId);
              const sets = db.workoutSets.filter((x) => x.sessionId === s.id);
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-3 py-2.5">
                  <span className="text-xs font-bold text-ink-500">{w?.label ?? "?"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{w?.name ?? "Treino"}</span>
                    <span className="block text-xs text-ink-500">
                      {formatDate(s.startedAt)} &middot; {sets.length} séries
                    </span>
                  </span>
                  {s.rpe != null && <Badge tone="neutral">RPE {s.rpe}</Badge>}
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}
