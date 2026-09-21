import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildStudentView, nextWorkoutFor, resolveWorkout } from "@/lib/queries";
import { currentMonth, formatMonth, relativeDays, todayISO } from "@/lib/dates";
import { Badge, Card, LinkButton, Progress, SectionTitle, toneForScore } from "@/components/ui";
import { Logo } from "@/components/logo";

export default async function StudentHome() {
  const { user, student } = await requireStudent();
  const view = buildStudentView(student.id)!;
  const db = getDb();
  const workout = nextWorkoutFor(student.id);
  const resolved = workout ? resolveWorkout(workout.id, student.id) : null;

  const checkinPending = view.currentCheckin?.status !== "respondido";
  const photoPending = !view.hasPhotoThisMonth;
  const anamnesis = db.anamnesis.find((a) => a.studentId === student.id);
  const anamnesisPending = !anamnesis?.answeredAt;

  const habitToday = db.habitLogs.find((h) => h.studentId === student.id && h.date === todayISO());
  const habitsDone = habitToday
    ? [habitToday.water, habitToday.nutrition, habitToday.sleep, habitToday.steps].filter(Boolean).length
    : 0;

  const trainedToday = db.workoutSessions.some(
    (s) => s.studentId === student.id && s.finishedAt && s.startedAt.slice(0, 10) === todayISO(),
  );

  const todo = [checkinPending, photoPending, anamnesisPending, !trainedToday].filter(Boolean).length;

  return (
    <div className="space-y-5 lb-enter">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-400">Olá,</p>
          <h1 className="text-2xl font-bold tracking-tight">{user.name.split(" ")[0]}</h1>
        </div>
        <Logo size="sm" className="scale-90" />
      </header>

      <Card>
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Sua semana
          </p>
          <span className="text-sm font-bold tabular-nums">{view.adherence.overall}%</span>
        </div>
        <Progress className="mt-2" value={view.adherence.overall} tone={toneForScore(view.adherence.overall)} />
        <p className="mt-2 text-xs text-ink-500">
          {todo === 0 ? "Tudo em dia. Bom trabalho." : `${todo} ${todo === 1 ? "pendência" : "pendências"} para hoje`}
        </p>
      </Card>

      <section>
        <SectionTitle>O que fazer hoje</SectionTitle>
        <div className="space-y-3">
          {workout && resolved ? (
            <Card className="border-lime-accent/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-accent">
                    Treino {workout.label}
                  </p>
                  <h3 className="mt-1 text-lg font-bold">{workout.name}</h3>
                  <p className="mt-1 text-xs text-ink-400">
                    {resolved.items.length} exercícios &middot; {resolved.totalSets} séries &middot; ~{workout.estimatedMinutes} min
                  </p>
                </div>
                {trainedToday && <Badge tone="ok">feito hoje</Badge>}
              </div>
              <LinkButton href={`/aluno/treinos/${workout.id}`} size="lg" className="mt-4">
                {trainedToday ? "Treinar de novo" : "Iniciar treino"}
              </LinkButton>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-ink-400">
                Seu personal ainda não prescreveu um treino. Você será avisado assim que estiver disponível.
              </p>
            </Card>
          )}

          {anamnesisPending && (
            <TodoCard
              href="/aluno/anamnese"
              tone="warn"
              title="Anamnese pendente"
              description="Responda para o Lucas montar seu treino com segurança."
              cta="Responder"
            />
          )}

          {checkinPending && (
            <TodoCard
              href="/aluno/checkin"
              tone="warn"
              title="Check-in semanal disponível"
              description="Leva menos de 2 minutos e guia os ajustes da próxima semana."
              cta="Responder"
            />
          )}

          {photoPending && (
            <TodoCard
              href="/aluno/evolucao"
              tone="accent"
              title={`Foto de ${formatMonth(currentMonth())} pendente`}
              description="Registre frente, lateral e costas para comparar sua evolução."
              cta="Registrar"
            />
          )}

          <TodoCard
            href="/aluno/habitos"
            tone={habitsDone >= 3 ? "ok" : "neutral"}
            title={`Hábitos de hoje - ${habitsDone}/4`}
            description="Água, alimentação, sono e passos."
            cta="Marcar"
          />
        </div>
      </section>

      <section>
        <SectionTitle action={<Link href="/aluno/evolucao" className="text-xs font-semibold text-lime-accent">ver tudo</Link>}>
          Sua evolução
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Peso" value={view.weight != null ? `${view.weight}` : "--"} unit="kg" />
          <MiniStat
            label="Cintura"
            value={view.lastAssessment?.measurements.cintura != null ? `${view.lastAssessment.measurements.cintura}` : "--"}
            unit="cm"
          />
          <MiniStat label="Frequência" value={`${view.frequency}`} unit="%" />
        </div>
        <p className="mt-2 text-xs text-ink-500">Último treino {relativeDays(view.lastSessionDate)}</p>
      </section>
    </div>
  );
}

function TodoCard({
  href, title, description, cta, tone,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  tone: "warn" | "accent" | "ok" | "neutral";
}) {
  const ring =
    tone === "warn" ? "border-warn/30" : tone === "accent" ? "border-lime-accent/30" : tone === "ok" ? "border-ok/30" : "border-ink-800";
  return (
    <Link href={href} className={`block rounded-[18px] border ${ring} bg-ink-900 p-4 transition-colors hover:border-ink-600`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-100">{title}</p>
          <p className="mt-0.5 text-xs text-ink-400">{description}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-semibold text-ink-200">
          {cta}
        </span>
      </div>
    </Link>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[18px] border border-ink-800 bg-ink-900 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-xs font-medium text-ink-500">{unit}</span>
      </p>
    </div>
  );
}
