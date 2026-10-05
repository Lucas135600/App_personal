import { addDays, parseISODate, todayISO, toISODate } from "./dates";
import type { Attendance, ClassSchedule, Database, Student } from "./types";

/* Aula presencial: do horário marcado até o contador do pacote.
 *
 * Três regras moram aqui, e só aqui, porque a agenda do personal, o calendário
 * do aluno, a notificação e o cron precisam responder igual:
 *
 *   1. Quando uma aula "terminou" — é o que libera a pergunta ao personal.
 *   2. O que desconta do pacote — aula dada e falta do aluno descontam;
 *      cancelamento e remarcação, não.
 *   3. Como numerar "aula 4/12" — o ciclo fecha ao completar o pacote, não no
 *      dia 1º: depois da 12/12 a próxima aula volta a ser 1/12.
 */

/** Quantos dias para trás a confirmação ainda é cobrada. Além disso a aula
 *  vira histórico: perguntar "houve aula?" de um mês atrás não ajuda ninguém,
 *  e o personal ainda pode registrar na mão pela agenda. */
export const JANELA_CONFIRMACAO_DIAS = 21;

export interface ClassOccurrence {
  studentId: string;
  date: string;
  startTime: string;
  durationMin: number;
}

/** Instante em que a aula acaba, no fuso de quem está rodando o app. */
export function classEndsAt(date: string, startTime: string, durationMin: number): Date {
  const [h, m] = startTime.split(":").map(Number);
  const d = parseISODate(date);
  d.setHours(h || 0, m || 0, 0, 0);
  d.setMinutes(d.getMinutes() + durationMin);
  return d;
}

export function alreadyEnded(occ: ClassOccurrence, now = new Date()): boolean {
  return classEndsAt(occ.date, occ.startTime, occ.durationMin).getTime() <= now.getTime();
}

/** 'HH:MM' -> '18h' / '18h30', como o personal fala. */
export function formatTime(startTime: string): string {
  if (!startTime) return "";
  const [h, m] = startTime.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** O aluno ocupa horário do personal? Online treina sozinho. */
export function ocupaHorario(student: Student): boolean {
  return student.modality !== "online";
}

/** Aulas com hora marcada de um aluno, dia a dia, dentro de um intervalo.
 *  Só os dias que estão na grade E têm horário cadastrado. */
export function occurrencesBetween(
  student: Student,
  schedule: ClassSchedule[],
  fromISO: string,
  toISOStr: string,
): ClassOccurrence[] {
  if (!ocupaHorario(student)) return [];

  const porDia = new Map(schedule.filter((c) => c.studentId === student.id).map((c) => [c.weekday, c]));
  if (porDia.size === 0) return [];

  const inicio = fromISO > student.startDate ? fromISO : student.startDate;
  const out: ClassOccurrence[] = [];

  for (let date = inicio; date <= toISOStr; date = addDays(date, 1)) {
    const dow = parseISODate(date).getDay();
    const slot = porDia.get(dow);
    if (!slot || !student.trainingDays.includes(dow)) continue;
    out.push({
      studentId: student.id,
      date,
      startTime: slot.startTime,
      durationMin: slot.durationMin,
    });
  }
  return out;
}

/** Próxima aula com hora marcada, a partir de hoje. Olha duas semanas à
 *  frente: além disso a grade é sempre a mesma e a resposta deixa de informar.
 *  A aula de hoje só conta enquanto não terminou. */
export function nextOccurrence(
  student: Student,
  schedule: ClassSchedule[],
  now = new Date(),
): ClassOccurrence | null {
  const hoje = toISODate(now);
  const proximas = occurrencesBetween(student, schedule, hoje, addDays(hoje, 14));
  return proximas.find((occ) => !alreadyEnded(occ, now)) ?? null;
}

export interface PendingClass extends ClassOccurrence {
  studentName: string;
  studentColor: string;
}

/** Aulas cujo horário já passou e que o personal ainda não respondeu.
 *  É o que vira notificação e o que fica em aberto na agenda. */
export function pendingConfirmations(db: Database, now = new Date()): PendingClass[] {
  const hoje = toISODate(now);
  const desde = addDays(hoje, -JANELA_CONFIRMACAO_DIAS);

  const respondidas = new Set(db.attendance.map((a) => `${a.studentId}|${a.date}`));
  const out: PendingClass[] = [];

  for (const student of db.students) {
    if (student.status !== "ativo") continue;
    const user = db.users.find((u) => u.id === student.userId);

    for (const occ of occurrencesBetween(student, db.classSchedule, desde, hoje)) {
      if (respondidas.has(`${occ.studentId}|${occ.date}`)) continue;
      if (!alreadyEnded(occ, now)) continue;
      out.push({
        ...occ,
        studentName: user?.name ?? "Aluno",
        studentColor: user?.avatarColor ?? "#9aa1ac",
      });
    }
  }

  // Mais antigas primeiro: é a ordem em que o personal deve resolver.
  return out.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

/* --------------------------------------------------------- contador do pacote */

export interface ClassCount {
  /** Posição no ciclo: o 4 de "aula 4/12". */
  position: number;
  /** Tamanho do pacote: o 12 de "aula 4/12". */
  total: number;
  /** Quantos pacotes já fecharam antes deste. */
  cycle: number;
}

/** A numeração de cada aula que descontou do pacote, por data.
 *  Vazio quando o aluno não tem pacote contratado — aí não há o que numerar. */
export function classCountsByDate(
  student: Student,
  attendance: Attendance[],
): Map<string, ClassCount> {
  const out = new Map<string, ClassCount>();
  const total = student.monthlyClasses;
  if (total <= 0) return out;

  const consumidas = attendance
    .filter((a) => a.studentId === student.id && a.consumes)
    .sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
    );

  consumidas.forEach((a, i) => {
    const n = i + 1;
    const cycle = Math.ceil(n / total);
    out.set(a.date, { position: n - (cycle - 1) * total, total, cycle });
  });

  return out;
}

/** Onde o aluno está no pacote agora: "4/12", e quantas faltam fechar. */
export function currentCycle(student: Student, attendance: Attendance[]) {
  const counts = classCountsByDate(student, attendance);
  const total = student.monthlyClasses;
  const ultima = [...counts.values()].at(-1);

  const position = ultima?.position ?? 0;
  // Pacote recém-fechado (12/12) já conta como ciclo encerrado: a próxima é 1.
  const fechado = total > 0 && position === total;

  return {
    total,
    position,
    cycle: ultima?.cycle ?? 1,
    restantes: total > 0 ? total - position : 0,
    fechado,
    proxima: total > 0 ? (fechado ? 1 : position + 1) : 0,
  };
}

/** "aula 4/12" — o rótulo que aparece nos dois calendários. */
export function classLabel(count: ClassCount | undefined): string {
  return count ? `aula ${count.position}/${count.total}` : "";
}

/** Se a aula desconta do pacote, a partir da resposta do personal.
 *  Aula dada e falta do aluno descontam: o horário foi reservado e gasto.
 *  Cancelada e remarcada não — o personal não entregou a aula. */
export function consumesPackage(present: boolean, reason: Attendance["reason"]): boolean {
  if (present) return true;
  return reason === "falta_aluno";
}

export const REASON_LABEL: Record<Attendance["reason"], string> = {
  "": "aula realizada",
  falta_aluno: "falta do aluno",
  cancelada: "aula cancelada",
  remarcada: "aula remarcada",
};

/** Horário previsto de um aluno num dia, ou '' se não tem hora marcada. */
export function scheduledTime(schedule: ClassSchedule[], studentId: string, date: string): string {
  const dow = parseISODate(date).getDay();
  return schedule.find((c) => c.studentId === studentId && c.weekday === dow)?.startTime ?? "";
}

/** Hoje, em ISO — reexportado para quem só importa deste módulo. */
export { todayISO };
