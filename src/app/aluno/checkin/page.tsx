import { requireStudent } from "@/lib/auth";
import { getDb, mutate } from "@/lib/db";
import { checkinHistory, ensureCurrentCheckin } from "@/lib/queries";
import { addDays, currentWeekStart, formatDate } from "@/lib/dates";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { CheckinForm } from "./checkin-form";

import { SCALE_LABEL } from "@/lib/labels";

export default async function CheckinPage() {
  const { student } = await requireStudent();
  mutate((d) => ensureCurrentCheckin(student.id, student.professionalId, d));

  const db = getDb();
  const weekStart = currentWeekStart();
  const current = db.checkins.find((c) => c.studentId === student.id && c.weekStart === weekStart)!;
  const history = checkinHistory(student.id, 6).filter((c) => c.weekStart !== weekStart);

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Check-in semanal</h1>
        <p className="mt-1 text-sm text-ink-400">
          Semana de {formatDate(weekStart)} a {formatDate(addDays(weekStart, 6))}
        </p>
      </header>

      {current.status === "respondido" ? (
        <Card className="border-ok/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink-100">Check-in concluído</p>
              <p className="mt-0.5 text-xs text-ink-400">
                Enviado em {formatDate(current.answeredAt)}
              </p>
            </div>
            <Badge tone="ok">respondido</Badge>
          </div>
          {current.coachReply && (
            <div className="mt-4 rounded-xl bg-lime-accent/10 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-lime-accent">
                Resposta do Lucas
              </p>
              <p className="mt-1 text-sm text-ink-200">{current.coachReply}</p>
            </div>
          )}
        </Card>
      ) : (
        <CheckinForm
          weekStart={weekStart}
          defaultWorkouts={student.trainingDays.length}
        />
      )}

      {history.length > 0 && (
        <section>
          <SectionTitle>Semanas anteriores</SectionTitle>
          <ul className="space-y-2">
            {history.map((c) => (
              <li key={c.id}>
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{formatDate(c.weekStart)}</p>
                    <Badge tone={c.status === "respondido" ? "ok" : "danger"}>{c.status}</Badge>
                  </div>
                  {c.answers && (
                    <p className="mt-2 text-xs text-ink-400">
                      {c.answers.workoutsDone} treinos &middot; disposição {SCALE_LABEL[c.answers.energy]} &middot; sono{" "}
                      {SCALE_LABEL[c.answers.sleep]}
                      {c.answers.weight != null ? ` - ${c.answers.weight} kg` : ""}
                    </p>
                  )}
                  {c.coachReply && (
                    <p className="mt-2 rounded-xl bg-ink-850 px-3 py-2 text-xs text-ink-300">
                      Lucas: {c.coachReply}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
