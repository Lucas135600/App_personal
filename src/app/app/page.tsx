import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { buildDashboard } from "@/lib/queries";
import { Avatar, Badge, Card, EmptyState, LinkButton, Progress, SectionTitle, Stat, toneForScore } from "@/components/ui";
import { Ring } from "@/components/charts";
import { WEEKDAY_LABELS, relativeDays, todayISO } from "@/lib/dates";
import { MODALITY_LABEL } from "@/lib/labels";

export default async function DashboardPage() {
  const pro = await requirePersonal();
  const d = buildDashboard(pro.id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const dow = new Date(`${todayISO()}T12:00:00`).getDay();

  return (
    <div className="mx-auto max-w-6xl space-y-6 lb-enter">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {pro.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {WEEKDAY_LABELS[dow]} &middot; {d.scheduledToday} {d.scheduledToday === 1 ? "aluno" : "alunos"} com treino previsto hoje
          </p>
        </div>
        <LinkButton href="/app/alunos/novo">+ Novo aluno</LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Alunos ativos" value={d.total} sub={`${d.presencial} presencial - ${d.online} online - ${d.hibrido} híbrido`} />
        <Stat label="Treinos hoje" value={`${d.trainedToday}/${d.scheduledToday}`} sub="realizados / previstos" />
        <Stat label="Check-ins pendentes" value={d.checkinsPending} tone={d.checkinsPending ? "warn" : "ok"} sub="semana atual" />
        <Stat label="Check-ins atrasados" value={d.checkinsLate} tone={d.checkinsLate ? "danger" : "ok"} sub="últimas 4 semanas" />
        <Stat label="Frequência média" value={`${d.avgFrequency}%`} tone={toneForScore(d.avgFrequency)} sub="últimas 4 semanas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle
            action={<span className="text-xs text-ink-500">{d.attention.length} alunos</span>}
          >
            Precisam da sua atenção
          </SectionTitle>

          {d.attention.length === 0 ? (
            <EmptyState title="Nenhum alerta aberto" description="Todos os alunos estao em dia com treino, check-in e avaliação." />
          ) : (
            <ul className="space-y-2">
              {d.attention.map(({ view, alerts }) => (
                <li key={view.student.id}>
                  <Link
                    href={`/app/alunos/${view.student.id}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3 transition-colors hover:border-ink-600"
                  >
                    <Avatar name={view.user.name} color={view.user.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-100">{view.user.name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {alerts.slice(0, 3).map((a) => (
                          <Badge key={a.label} tone={a.level === "danger" ? "danger" : "warn"}>
                            {a.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-lg font-bold tabular-nums text-ink-100">{view.frequency}%</p>
                      <p className="text-[11px] text-ink-500">frequência</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle action={<Link href="/app/checkins" className="text-xs font-semibold text-lime-accent">ver todos</Link>}>
              Check-ins da semana
            </SectionTitle>
            <div className="flex items-center gap-5">
              <Ring
                value={d.total ? Math.round((d.checkinsAnswered / d.total) * 100) : 0}
                caption="Respondidos"
              />
              <ul className="flex-1 space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-300">
                    <span className="size-2 rounded-full bg-ok" /> Respondidos
                  </span>
                  <span className="font-semibold tabular-nums">{d.checkinsAnswered}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-300">
                    <span className="size-2 rounded-full bg-warn" /> Pendentes
                  </span>
                  <span className="font-semibold tabular-nums">{d.checkinsPending}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink-300">
                    <span className="size-2 rounded-full bg-danger" /> Atrasados
                  </span>
                  <span className="font-semibold tabular-nums">{d.checkinsLate}</span>
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <SectionTitle>Radar de adesão</SectionTitle>
            <ul className="space-y-3">
              {d.views
                .slice()
                .sort((a, b) => a.adherence.overall - b.adherence.overall)
                .slice(0, 5)
                .map((v) => (
                  <li key={v.student.id}>
                    <Link href={`/app/alunos/${v.student.id}`} className="block">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-ink-200">{v.user.name}</span>
                        <span className="tabular-nums text-ink-400">{v.adherence.overall}%</span>
                      </div>
                      <Progress className="mt-1.5" value={v.adherence.overall} tone={toneForScore(v.adherence.overall)} />
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5">
          <SectionTitle>Alunos</SectionTitle>
          <Link href="/app/alunos" className="mb-4 text-xs font-semibold text-lime-accent">
            abrir lista completa
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-ink-800 text-left text-[11px] uppercase tracking-[0.1em] text-ink-500">
                <th className="px-5 py-2.5 font-semibold">Aluno</th>
                <th className="px-3 py-2.5 font-semibold">Modalidade</th>
                <th className="px-3 py-2.5 font-semibold">Último treino</th>
                <th className="px-3 py-2.5 font-semibold">Check-in</th>
                <th className="px-3 py-2.5 font-semibold">Frequência</th>
                <th className="px-5 py-2.5 font-semibold">Atenção</th>
              </tr>
            </thead>
            <tbody>
              {d.views.map((v) => (
                <tr key={v.student.id} className="border-b border-ink-850 last:border-0 hover:bg-ink-850/60">
                  <td className="px-5 py-3">
                    <Link href={`/app/alunos/${v.student.id}`} className="flex items-center gap-3">
                      <Avatar name={v.user.name} color={v.user.avatarColor} size={32} />
                      <span>
                        <span className="block font-semibold text-ink-100">{v.user.name}</span>
                        <span className="block text-xs text-ink-500">{v.student.goal}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-ink-300">{MODALITY_LABEL[v.student.modality]}</td>
                  <td className="px-3 py-3 text-ink-300">{relativeDays(v.lastSessionDate)}</td>
                  <td className="px-3 py-3">
                    {v.currentCheckin?.status === "respondido" ? (
                      <Badge tone="ok">Respondido</Badge>
                    ) : (v.currentCheckin?.status ?? "pendente") === "atrasado" ? (
                      <Badge tone="danger">Atrasado</Badge>
                    ) : (
                      <Badge tone="warn">Pendente</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2">
                      <Progress value={v.frequency} tone={toneForScore(v.frequency)} className="w-20" />
                      <span className="tabular-nums text-xs text-ink-400">{v.frequency}%</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {v.alerts.length ? (
                      <Badge tone={v.alerts.some((a) => a.level === "danger") ? "danger" : "warn"}>
                        {v.alerts.length} alerta{v.alerts.length > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span className="text-xs text-ink-600">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
