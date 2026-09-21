export const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Data local (não UTC) no formato YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  const a = parseISODate(fromISO).getTime();
  const b = parseISODate(toISOStr).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return daysBetween(iso.slice(0, 10), todayISO());
}

/** Segunda-feira da semana de uma data. */
export function weekStart(iso: string): string {
  const d = parseISODate(iso);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

export function currentWeekStart(): string {
  return weekStart(todayISO());
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const d = parseISODate(iso.slice(0, 10));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const d = parseISODate(iso.slice(0, 10));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_LABELS[m - 1].toUpperCase()}/${String(y).slice(2)}`;
}

export function relativeDays(iso: string | null | undefined): string {
  const n = daysSince(iso);
  if (n === null) return "nunca";
  if (n <= 0) return "hoje";
  if (n === 1) return "ontem";
  return `há ${n} dias`;
}

export function age(birthDate: string): number {
  const b = parseISODate(birthDate);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

/** Os 7 dias (seg..dom) de uma semana. */
export function weekDays(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
}

/** Nome do mês por extenso, para títulos: "setembro de 2026". */
export function formatMonthLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[m - 1]} de ${y}`;
}

/** Último dia do mês, como data ISO. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return toISODate(new Date(y, m, 0));
}

/** Semanas (seg..dom) que cobrem o mês inteiro, incluindo os dias vizinhos
 *  necessários para fechar a grade do calendário. */
export function monthGrid(month: string): string[][] {
  const start = weekStart(`${month}-01`);
  const end = addDays(weekStart(monthEnd(month)), 6);
  const weeks: string[][] = [];
  let cursor = start;
  while (cursor <= end) {
    weeks.push(weekDays(cursor));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
