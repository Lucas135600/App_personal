import { formatDate, WEEKDAY_LABELS } from "@/lib/dates";
import { classLabel, formatTime, REASON_LABEL } from "@/lib/classes";
import type { StudentDay } from "@/lib/queries";
import type { AbsenceReason } from "@/lib/types";
import { cx } from "./ui";

/* O calendário de frequência de um aluno.
 *
 * Mora aqui, e não em cada tela, porque o personal e o aluno precisam ver
 * exatamente a mesma coisa: se o dia 14 é "aula 4/12" para um e "aula 5/12"
 * para o outro, a conversa entre os dois acaba em discussão sobre o app. */

const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

export function AttendanceGrid({
  weeks,
  ocupaHorario,
}: {
  weeks: StudentDay[][];
  ocupaHorario: boolean;
}) {
  return (
    <div>
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
        {weeks.map((week) => (
          <div key={week[0].date} className="grid grid-cols-7 gap-1.5">
            {week.map((day) => (
              <AttendanceCell key={day.date} day={day} ocupaHorario={ocupaHorario} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceCell({ day, ocupaHorario }: { day: StudentDay; ocupaHorario: boolean }) {
  const feito = ocupaHorario ? day.present || day.trained : day.trained;
  const semRegistro = day.scheduled && !feito && !day.absent && !day.isFuture;

  const estado = feito
    ? "bg-lime-accent text-ink-950"
    : day.absent
      ? "bg-danger/70 text-ink-950"
      : day.pending
        ? "border-2 border-warn/70 text-warn"
        : semRegistro
          ? "border-2 border-ink-600 text-ink-400"
          : day.scheduled
            ? "border-2 border-dashed border-ink-700 text-ink-500"
            : "bg-ink-850 text-ink-600";

  // O rótulo curto dentro da célula é a numeração da aula quando ela existe —
  // é o que o aluno procura ao abrir o calendário. Sem pacote, cai na letra do
  // treino, que era o que a tela já mostrava.
  const marca = day.count ? `${day.count.position}/${day.count.total}` : feito ? day.workoutLabel : null;

  return (
    <div
      title={tituloDoDia(day, feito)}
      className={cx(
        "flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-bold tabular-nums",
        estado,
        !day.inMonth && "opacity-30",
        day.isToday && "ring-2 ring-lime-accent ring-offset-2 ring-offset-ink-900",
      )}
    >
      {day.day}
      {marca && <span className="text-[8px] font-extrabold opacity-70">{marca}</span>}
    </div>
  );
}

function tituloDoDia(day: StudentDay, feito: boolean): string {
  const partes = [formatDate(day.date)];
  if (day.startTime) partes.push(formatTime(day.startTime));

  if (feito) {
    partes.push(day.count ? classLabel(day.count) : "treinou");
    if (day.workoutLabel) partes.push(`treino ${day.workoutLabel}`);
  } else if (day.absent) {
    partes.push(REASON_LABEL[(day.reason as AbsenceReason) || "falta_aluno"]);
    if (day.count) partes.push(`${classLabel(day.count)} — descontada do pacote`);
  } else if (day.pending) {
    partes.push("aguardando confirmação do personal");
  } else if (day.scheduled) {
    partes.push(day.isFuture ? "aula prevista" : "sem registro");
  }

  return partes.join(" — ");
}

export function AttendanceLegend({ extras = 0 }: { extras?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-500">
      <Item className="bg-lime-accent" label="aula realizada" />
      <Item className="border-2 border-warn/70" label="aguardando confirmação" />
      <Item className="bg-danger/70" label="sem aula" />
      <Item className="border-2 border-ink-600" label="previsto, sem registro" />
      <Item className="bg-ink-850" label="sem aula prevista" />
      {extras > 0 && (
        <span className="ml-auto">
          {extras} {extras === 1 ? "treino extra" : "treinos extras"} fora da grade
        </span>
      )}
    </div>
  );
}

function Item({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx("inline-block size-3 rounded-[5px]", className)} />
      {label}
    </span>
  );
}
