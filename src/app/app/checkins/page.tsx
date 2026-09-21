import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { listStudentViews } from "@/lib/queries";
import { addDays, currentWeekStart, formatDate } from "@/lib/dates";
import { Avatar, Badge, Card, EmptyState, SectionTitle, Stat } from "@/components/ui";

export default async function CheckinsPage() {
  const pro = await requirePersonal();
  const db = await getDb();
  const views = await listStudentViews(pro.id);
  const thisWeek = currentWeekStart();

  const rows = views.map((v) => ({
    view: v,
    checkin: db.checkins.find((c) => c.studentId === v.student.id && c.weekStart === thisWeek) ?? null,
  }));

  const answered = rows.filter((r) => r.checkin?.status === "respondido");
  const pending = rows.filter((r) => r.checkin?.status !== "respondido");

  return (
    <div className="mx-auto max-w-5xl space-y-6 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Check-ins</h1>
        <p className="mt-1 text-sm text-ink-400">
          Semana de {formatDate(thisWeek)} a {formatDate(addDays(thisWeek, 6))}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Respondidos" value={answered.length} tone="ok" />
        <Stat label="Pendentes" value={pending.length} tone={pending.length ? "warn" : "ok"} />
        <Stat label="Taxa da semana" value={`${views.length ? Math.round((answered.length / views.length) * 100) : 0}%`} />
      </div>

      <Card>
        <SectionTitle>Aguardando resposta</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState title="Todos responderam" description="Nenhum check-in pendente nesta semana." />
        ) : (
          <ul className="space-y-2">
            {pending.map(({ view }) => (
              <li key={view.student.id}>
                <Link
                  href={`/app/alunos/${view.student.id}?tab=checkins`}
                  className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3 hover:border-ink-600"
                >
                  <Avatar name={view.user.name} color={view.user.avatarColor} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{view.user.name}</span>
                    <span className="block text-xs text-ink-500">
                      último respondido:{" "}
                      {view.lastAnsweredCheckin ? formatDate(view.lastAnsweredCheckin.weekStart) : "nunca"}
                    </span>
                  </span>
                  <Badge tone={view.currentCheckin?.status === "atrasado" ? "danger" : "warn"}>
                    {view.currentCheckin?.status ?? "pendente"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Respondidos nesta semana</SectionTitle>
        {answered.length === 0 ? (
          <EmptyState title="Nenhuma resposta ainda" />
        ) : (
          <ul className="space-y-2">
            {answered.map(({ view, checkin }) => (
              <li key={view.student.id}>
                <Link
                  href={`/app/alunos/${view.student.id}?tab=checkins`}
                  className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3 hover:border-ink-600"
                >
                  <Avatar name={view.user.name} color={view.user.avatarColor} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{view.user.name}</span>
                    <span className="block text-xs text-ink-500">
                      {checkin?.answers?.workoutsDone ?? 0} treinos &middot; peso{" "}
                      {checkin?.answers?.weight ?? "--"} kg
                      {checkin?.answers?.pain ? " - relatou dor" : ""}
                    </span>
                  </span>
                  <Badge tone={checkin?.coachReply ? "ok" : "accent"}>
                    {checkin?.coachReply ? "respondido por você" : "revisar"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
