import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { buildStudentAttendance } from "@/lib/queries";
import { formatTime, REASON_LABEL } from "@/lib/classes";
import {
  addMonths, currentMonth, formatDate, formatMonthLong, todayISO,
} from "@/lib/dates";
import { capitalizeFirst } from "@/lib/labels";
import { AttendanceGrid, AttendanceLegend } from "@/components/attendance-calendar";
import { Badge, Card, EmptyState, SectionTitle, Stat } from "@/components/ui";
import type { AbsenceReason } from "@/lib/types";

/* O calendário do aluno: as mesmas aulas que o personal confirma, com a mesma
   numeração. Só de leitura — quem responde "houve a aula?" é o personal. */

export default async function StudentAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { student } = await requireStudent();
  const params = await searchParams;

  const month = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? params.mes! : currentMonth();
  const freq = (await buildStudentAttendance(student.id, month))!;
  const { pacote } = freq;

  const href = (m: string) => `/aluno/agenda?mes=${m}`;
  const hoje = todayISO();

  // O que já aconteceu no mês, do mais recente para o mais antigo: é a lista
  // que o aluno confere quando quer saber se a aula de ontem entrou.
  const registros = freq.weeks
    .flat()
    .filter((d) => d.inMonth && d.date <= hoje && (d.present || d.absent || d.pending))
    .reverse();

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Minhas aulas</h1>
        <p className="mt-1 text-sm text-ink-400">
          {pacote.total > 0
            ? "Cada aula confirmada pelo seu personal entra aqui."
            : "Seu histórico de treinos, dia a dia."}
        </p>
      </header>

      {pacote.total > 0 && (
        <Card className="border-lime-accent/30">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Pacote contratado
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              {pacote.position}
              <span className="text-ink-500">/{pacote.total}</span>
            </span>
            <span className="text-sm text-ink-400">aulas</span>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            {pacote.fechado
              ? "Pacote completo. A próxima aula começa um novo ciclo."
              : `Faltam ${pacote.restantes} ${pacote.restantes === 1 ? "aula" : "aulas"} para fechar o pacote.`}
          </p>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href={href(addMonths(month, -1))}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-300"
          >
            &larr;
          </Link>
          <h2 className="text-sm font-bold">{capitalizeFirst(formatMonthLong(month))}</h2>
          <Link
            href={href(addMonths(month, 1))}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-300"
          >
            &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          <Stat label="Previstas" value={freq.previstas} />
          <Stat label="Realizadas" value={freq.realizadas} tone="accent" />
          <Stat label="Faltas" value={freq.faltas || "--"} tone={freq.faltas ? "warn" : "neutral"} />
        </div>

        <div className="px-4">
          <AttendanceGrid weeks={freq.weeks} ocupaHorario={freq.ocupaHorario} />
        </div>

        <div className="px-4 pb-5 pt-4">
          <AttendanceLegend extras={freq.extras} />
        </div>
      </Card>

      <section>
        <SectionTitle>No mês</SectionTitle>
        {registros.length === 0 ? (
          <EmptyState title="Nenhuma aula registrada neste mês" />
        ) : (
          <ul className="space-y-2">
            {registros.map((d) => (
              <li
                key={d.date}
                className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{formatDate(d.date)}</p>
                  <p className="text-[11px] text-ink-500">
                    {d.startTime ? formatTime(d.startTime) : "sem horário fixo"}
                    {d.absent && ` · ${REASON_LABEL[(d.reason as AbsenceReason) || "falta_aluno"]}`}
                  </p>
                </div>
                {d.count ? (
                  <Badge tone={d.present ? "accent" : "danger"}>
                    aula {d.count.position}/{d.count.total}
                  </Badge>
                ) : d.pending ? (
                  <Badge tone="warn">a confirmar</Badge>
                ) : d.present ? (
                  <Badge tone="ok">realizada</Badge>
                ) : (
                  <Badge tone="neutral">sem aula</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-500">
          A numeração só aparece depois que o personal confirma a aula. Falta sua desconta do
          pacote; aula cancelada ou remarcada por ele, não.
        </p>
      </section>
    </div>
  );
}
