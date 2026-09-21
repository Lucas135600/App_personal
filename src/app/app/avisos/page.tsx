import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { buildDashboard } from "@/lib/queries";
import {
  clearPersonalNotificationsAction,
  markPersonalNotificationsReadAction,
} from "@/lib/actions/personal";
import { formatDate, relativeDays, todayISO } from "@/lib/dates";
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle, Stat } from "@/components/ui";

export default async function NotificationsPage() {
  const pro = await requirePersonal();
  const db = await getDb();
  const dashboard = await buildDashboard(pro.id);

  const notifications = db.notifications
    .filter((n) => n.userId === pro.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((n) => !n.read).length;

  // Alertas sao calculados na hora pelo motor de regras; notificacoes sao o
  // registro do que aconteceu. As duas coisas convivem nesta tela.
  const alerts = dashboard.attention;

  return (
    <div className="mx-auto max-w-4xl space-y-6 lb-enter">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avisos</h1>
          <p className="mt-1 text-sm text-ink-400">
            O que os alunos fizeram e quem precisa de você hoje.
          </p>
        </div>
        {unread > 0 && (
          <form action={markPersonalNotificationsReadAction}>
            <Button type="submit" variant="ghost" size="sm">
              Marcar todas como lidas
            </Button>
          </form>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Não lidos" value={unread} tone={unread ? "accent" : "neutral"} />
        <Stat
          label="Alunos em alerta"
          value={alerts.length}
          tone={alerts.length ? "warn" : "ok"}
        />
        <Stat
          label="Check-ins pendentes"
          value={dashboard.checkinsPending + dashboard.checkinsLate}
          tone={dashboard.checkinsPending + dashboard.checkinsLate ? "warn" : "ok"}
        />
      </div>

      <Card>
        <SectionTitle>Precisam de ação</SectionTitle>
        {alerts.length === 0 ? (
          <EmptyState
            title="Nenhum alerta aberto"
            description="Todos os alunos estão em dia com treino, check-in e avaliação."
          />
        ) : (
          <ul className="space-y-2">
            {alerts.map(({ view, alerts: list }) => (
              <li key={view.student.id}>
                <Link
                  href={`/app/alunos/${view.student.id}`}
                  className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3 transition-colors hover:border-ink-600"
                >
                  <Avatar name={view.user.name} color={view.user.avatarColor} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-100">
                      {view.user.name}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {list.map((a) => (
                        <Badge key={a.label} tone={a.level === "danger" ? "danger" : "warn"}>
                          {a.label}
                        </Badge>
                      ))}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-xs text-ink-500 sm:block">
                    último treino
                    <br />
                    {relativeDays(view.lastSessionDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle
          action={
            notifications.length > 0 ? (
              <form action={clearPersonalNotificationsAction}>
                <button className="text-xs font-semibold text-ink-500 hover:text-danger">
                  limpar histórico
                </button>
              </form>
            ) : undefined
          }
        >
          Atividade recente
        </SectionTitle>

        {notifications.length === 0 ? (
          <EmptyState
            title="Nada por aqui ainda"
            description="Treinos concluídos, check-ins respondidos, fotos e anamneses aparecem nesta lista."
          />
        ) : (
          <ul className="space-y-2">
            {notifications.slice(0, 40).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link || "/app"}
                  className={
                    n.read
                      ? "flex gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3 transition-colors hover:border-ink-600"
                      : "flex gap-3 rounded-xl border border-lime-accent/30 bg-ink-850 p-3 transition-colors hover:border-lime-accent/60"
                  }
                >
                  <span
                    className={
                      n.read
                        ? "mt-1.5 size-2 shrink-0 rounded-full bg-ink-700"
                        : "mt-1.5 size-2 shrink-0 rounded-full bg-lime-accent"
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-100">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-400">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-500">
                    {n.createdAt.slice(0, 10) === todayISO() ? "hoje" : formatDate(n.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
