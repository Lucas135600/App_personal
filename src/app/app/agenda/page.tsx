import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { buildAgenda, type AgendaDay } from "@/lib/queries";
import { markAttendanceAction } from "@/lib/actions/personal";
import { classLabel, formatTime, type PendingClass } from "@/lib/classes";
import {
  addMonths, currentMonth, formatDate, formatMonthLong, formatShortDate, todayISO, WEEKDAY_LABELS,
} from "@/lib/dates";
import { capitalizeFirst, MODALITY_LABEL } from "@/lib/labels";
import {
  Avatar, Badge, Button, Card, cx, EmptyState, SectionTitle, Select, Stat,
} from "@/components/ui";

const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string }>;
}) {
  const pro = await requirePersonal();
  const params = await searchParams;

  const month = /^\d{4}-\d{2}$/.test(params.mes ?? "") ? params.mes! : currentMonth();
  const agenda = await buildAgenda(pro.id, month);

  const selectedDate =
    params.dia && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) ? params.dia : todayISO();
  const selected =
    agenda.weeks.flat().find((d) => d.date === selectedDate) ??
    agenda.weeks.flat().find((d) => d.isToday) ??
    null;

  const href = (m: string, d?: string) =>
    `/app/agenda?mes=${m}${d ? `&dia=${d}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-ink-400">
          Quem treina em cada dia e a contagem de aulas da semana e do mês.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Aulas presenciais — mês"
          value={`${agenda.mes.presenciaisRealizadas}/${agenda.mes.presenciaisPrevistas}`}
          sub="realizadas / previstas"
          tone="accent"
        />
        <Stat
          label="Aulas presenciais — semana"
          value={`${agenda.semana.presenciaisRealizadas}/${agenda.semana.presenciaisPrevistas}`}
          sub="semana atual"
        />
        <Stat
          label="Treinos online — mês"
          value={agenda.mes.treinosOnline}
          sub="registrados pelos alunos"
        />
        <Stat
          label="Faltas no mês"
          value={agenda.mes.faltas}
          tone={agenda.mes.faltas ? "warn" : "ok"}
        />
      </div>

      {agenda.pendentes.length > 0 && <PendingCard pendentes={agenda.pendentes} />}

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <Link
            href={href(addMonths(month, -1))}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-300 hover:bg-ink-800"
          >
            &larr;
          </Link>
          <h2 className="text-sm font-bold">{capitalizeFirst(formatMonthLong(month))}</h2>
          <div className="flex items-center gap-1">
            {month !== currentMonth() && (
              <Link
                href={href(currentMonth())}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-lime-accent hover:bg-ink-800"
              >
                hoje
              </Link>
            )}
            <Link
              href={href(addMonths(month, 1))}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-300 hover:bg-ink-800"
            >
              &rarr;
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto px-5 pb-5">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1.5 pb-1.5">
              {ORDEM_SEMANA.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink-500"
                >
                  {WEEKDAY_LABELS[d]}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {agenda.weeks.map((week) => (
                <div key={week[0].date} className="grid grid-cols-7 gap-1.5">
                  {week.map((day) => (
                    <DayCell
                      key={day.date}
                      day={day}
                      month={month}
                      active={selected?.date === day.date}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {selected && <DayPanel day={selected} month={month} />}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionTitle>Aulas por aluno — {formatMonthLong(month)}</SectionTitle>
        </div>
        {agenda.porAluno.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title="Nenhum aluno com aula prevista neste mês" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-y border-ink-800 text-left text-[11px] uppercase tracking-[0.1em] text-ink-500">
                  <th className="px-5 py-2.5 font-semibold">Aluno</th>
                  <th className="px-3 py-2.5 font-semibold">Modalidade</th>
                  <th className="px-3 py-2.5 font-semibold">Previstas</th>
                  <th className="px-3 py-2.5 font-semibold">Realizadas</th>
                  <th className="px-3 py-2.5 font-semibold">Faltas</th>
                  <th className="px-3 py-2.5 font-semibold">Pacote</th>
                  <th className="px-5 py-2.5 font-semibold">Aproveitamento</th>
                </tr>
              </thead>
              <tbody>
                {agenda.porAluno.map(({ student, previstas, realizadas, faltas, pacote }) => {
                  const pct = previstas ? Math.round((realizadas / previstas) * 100) : 0;
                  return (
                    <tr key={student.studentId} className="border-b border-ink-850 last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          href={`/app/alunos/${student.studentId}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={student.name} color={student.color} size={28} />
                          <span className="font-semibold text-ink-100">{student.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-ink-300">{MODALITY_LABEL[student.modality]}</td>
                      <td className="px-3 py-3 tabular-nums">{previstas}</td>
                      <td className="px-3 py-3 tabular-nums text-lime-accent">{realizadas}</td>
                      <td className="px-3 py-3 tabular-nums">{faltas || "--"}</td>
                      <td className="px-3 py-3 tabular-nums text-ink-300">
                        {pacote.total ? `${pacote.position}/${pacote.total}` : "--"}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-ink-300">
                        {previstas ? `${pct}%` : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 pb-5 pt-3 text-xs text-ink-500">
          Aula presencial conta quando você confirma que ela aconteceu. O pacote mostra em que
          ponto do contratado o aluno está e fecha ao completar — depois de 12/12, a próxima aula
          volta a ser 1/12. Falta do aluno desconta do pacote; aula cancelada ou remarcada, não.
          Aluno online não entra nesta contagem porque não ocupa horário.
        </p>
      </Card>
    </div>
  );
}

function DayCell({
  day,
  month,
  active,
}: {
  day: AgendaDay;
  month: string;
  active: boolean;
}) {
  const presenciais = day.scheduled.filter((s) => s.ocupaHorario);
  const feitas = presenciais.filter((s) => day.presentIds.includes(s.studentId)).length;
  const horarios = presenciais.map((s) => formatTime(s.startTime)).filter(Boolean);

  return (
    <Link
      href={`/app/agenda?mes=${month}&dia=${day.date}`}
      className={cx(
        "flex min-h-[86px] flex-col gap-1.5 rounded-xl border p-2 transition-colors",
        active
          ? "border-lime-accent bg-ink-850"
          : day.isToday
            ? "border-lime-accent/40 bg-ink-850 hover:border-lime-accent/70"
            : "border-ink-800 bg-ink-900 hover:border-ink-600",
        !day.inMonth && "opacity-40",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span
          className={cx(
            "text-xs font-bold tabular-nums",
            day.isToday ? "text-lime-accent" : "text-ink-300",
          )}
        >
          {day.day}
        </span>
        {presenciais.length > 0 && (
          <span
            className={cx(
              "text-[10px] tabular-nums",
              day.pendingIds.length ? "font-bold text-warn" : "text-ink-500",
            )}
          >
            {day.isFuture ? presenciais.length : `${feitas}/${presenciais.length}`}
          </span>
        )}
      </div>

      {horarios.length > 0 && (
        <div className="-mt-0.5 truncate text-[10px] tabular-nums text-ink-500">
          {horarios.slice(0, 2).join(" · ")}
          {horarios.length > 2 && ` +${horarios.length - 2}`}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {day.scheduled.slice(0, 6).map((s) => {
          const presente = day.presentIds.includes(s.studentId);
          const faltou = day.absentIds.includes(s.studentId);
          const treinou = day.trainedIds.includes(s.studentId);
          return (
            <span
              key={s.studentId}
              title={`${s.name} — ${MODALITY_LABEL[s.modality]}`}
              className={cx(
                "size-4 rounded-full border-2",
                faltou && "opacity-30",
                presente || treinou ? "border-transparent" : "bg-transparent",
              )}
              style={{
                background: presente || treinou ? s.color : "transparent",
                borderColor: presente || treinou ? "transparent" : s.color,
              }}
            />
          );
        })}
        {day.scheduled.length > 6 && (
          <span className="text-[10px] text-ink-500">+{day.scheduled.length - 6}</span>
        )}
      </div>
    </Link>
  );
}

function DayPanel({ day, month }: { day: AgendaDay; month: string }) {
  return (
    <Card>
      <SectionTitle
        action={
          <span className="text-xs text-ink-500">
            {day.scheduled.length} {day.scheduled.length === 1 ? "aluno previsto" : "alunos previstos"}
          </span>
        }
      >
        {formatDate(day.date)}
      </SectionTitle>

      {day.scheduled.length === 0 ? (
        <EmptyState title="Nenhum aluno com treino previsto neste dia" />
      ) : (
        <ul className="space-y-2">
          {day.scheduled.map((s) => {
            const presente = day.presentIds.includes(s.studentId);
            const faltou = day.absentIds.includes(s.studentId);
            const treinou = day.trainedIds.includes(s.studentId);
            const pendente = day.pendingIds.includes(s.studentId);
            const aula = classLabel(day.counts[s.studentId]);

            return (
              <li
                key={s.studentId}
                className={cx(
                  "flex flex-wrap items-center gap-3 rounded-xl border bg-ink-850 p-3",
                  pendente ? "border-warn/50" : "border-ink-800",
                )}
              >
                <Avatar name={s.name} color={s.color} size={32} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/alunos/${s.studentId}`}
                    className="block truncate text-sm font-semibold hover:text-lime-accent"
                  >
                    {s.name}
                  </Link>
                  <p className="text-[11px] text-ink-500">
                    {MODALITY_LABEL[s.modality]}
                    {s.startTime && ` · ${formatTime(s.startTime)}`}
                  </p>
                </div>

                {aula && <Badge tone="accent">{aula}</Badge>}

                {s.ocupaHorario ? (
                  <>
                    {presente ? (
                      <Badge tone="ok">aula realizada</Badge>
                    ) : faltou ? (
                      <Badge tone="danger">sem aula</Badge>
                    ) : pendente ? (
                      <Badge tone="warn">aguardando resposta</Badge>
                    ) : (
                      <Badge tone="neutral">sem registro</Badge>
                    )}
                    <ClassAnswer studentId={s.studentId} date={day.date} />
                  </>
                ) : (
                  <Badge tone={treinou ? "ok" : "neutral"}>
                    {treinou ? "treinou" : "aguardando treino"}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* --------------------------------------------- confirmação da aula realizada */

/* A pergunta é uma só — "houve a aula?" — mas o "não" precisa do motivo antes
   de virar registro: é o motivo que decide se a aula sai do pacote. Por isso o
   "não" leva a lista junto, em vez de um segundo passo em outra tela. */
function ClassAnswer({ studentId, date }: { studentId: string; date: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={markAttendanceAction}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="present" value="1" />
        <Button type="submit" size="sm">
          Houve
        </Button>
      </form>
      <form action={markAttendanceAction} className="flex items-center gap-1.5">
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="present" value="0" />
        <Select
          name="reason"
          defaultValue="falta_aluno"
          aria-label="Motivo de não ter havido aula"
          className="h-auto px-2.5 py-1.5 text-xs"
        >
          <option value="falta_aluno">Falta do aluno</option>
          <option value="cancelada">Cancelada</option>
          <option value="remarcada">Remarcada</option>
        </Select>
        <Button type="submit" size="sm" variant="outline">
          Não houve
        </Button>
      </form>
    </div>
  );
}

/* Aulas que já terminaram e seguem sem resposta. Fica no topo da agenda, e não
   só no sininho, porque a notificação some quando o personal a marca como lida
   — a aula sem resposta não pode sumir junto. */
function PendingCard({ pendentes }: { pendentes: PendingClass[] }) {
  return (
    <Card className="border-warn/40">
      <SectionTitle
        action={
          <span className="text-xs text-ink-500">
            {pendentes.length} {pendentes.length === 1 ? "aula" : "aulas"}
          </span>
        }
      >
        Houve a aula?
      </SectionTitle>
      <ul className="space-y-2">
        {pendentes.map((p) => (
          <li
            key={`${p.studentId}|${p.date}`}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3"
          >
            <Avatar name={p.studentName} color={p.studentColor} size={32} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/app/alunos/${p.studentId}`}
                className="block truncate text-sm font-semibold hover:text-lime-accent"
              >
                {p.studentName}
              </Link>
              <p className="text-[11px] text-ink-500">
                {formatShortDate(p.date)} · {formatTime(p.startTime)}
              </p>
            </div>
            <ClassAnswer studentId={p.studentId} date={p.date} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-500">
        Confirmar a aula é o que faz ela contar no pacote do aluno — e o que aparece no
        calendário dele como “aula 4/12”.
      </p>
    </Card>
  );
}
