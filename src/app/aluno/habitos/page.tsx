import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { toggleHabitAction } from "@/lib/actions/student";
import { currentWeekStart, formatShortDate, todayISO, WEEKDAY_LABELS, weekDays } from "@/lib/dates";
import { Card, Progress, SectionTitle, toneForScore } from "@/components/ui";
import type { HabitStatus } from "@/lib/types";

type HabitKey = "water" | "nutrition" | "sleep" | "steps" | "supplement";

const HABITS: Array<{ key: HabitKey; label: string; icon: string }> = [
  { key: "water", label: "Água", icon: "💧" },
  { key: "nutrition", label: "Alimentação", icon: "🥗" },
  { key: "sleep", label: "Sono", icon: "😴" },
  { key: "steps", label: "Passos", icon: "🚶" },
  { key: "supplement", label: "Suplemento", icon: "💊" },
];

/** 3,5 e não 3.5: o aluno lê em português. Corta o ",0" de valores redondos. */
function litros(ml: number): string {
  const l = ml / 1000;
  return (Number.isInteger(l) ? String(l) : l.toFixed(1).replace(".", ",")) + " L";
}

/* O botão tem três aparências porque o dado tem três estados. Cinza não é
   "falhou": é "ainda não respondi", e some da conta de consistência. */
const ESTILO: Record<HabitStatus, { botao: string; bolha: string; marca: string; leitura: string }> = {
  0: {
    botao: "border-ink-800 bg-ink-850",
    bolha: "size-6 rounded-full border border-ink-600",
    marca: "",
    leitura: "Toque para marcar",
  },
  1: {
    botao: "border-lime-accent/40 bg-lime-accent/10",
    bolha: "flex size-6 items-center justify-center rounded-full bg-lime-accent text-xs font-bold text-ink-950",
    marca: "✓",
    leitura: "Meta cumprida",
  },
  2: {
    botao: "border-danger/40 bg-danger/10",
    bolha: "flex size-6 items-center justify-center rounded-full bg-danger text-xs font-bold text-ink-950",
    marca: "✕",
    leitura: "Não cumpri hoje",
  },
};

export default async function HabitsPage() {
  const { student } = await requireStudent();
  const db = await getDb();
  const days = weekDays(currentWeekStart());
  const today = todayISO();

  const logs = new Map(
    db.habitLogs.filter((h) => h.studentId === student.id).map((h) => [h.date, h]),
  );
  const target = db.habitTargets.find((t) => t.studentId === student.id);

  /** Orientação do personal para o hábito, quando existe. */
  const meta = (key: HabitKey): string => {
    if (!target) return "";
    if (key === "water") return target.waterMl > 0 ? `Meta: ${litros(target.waterMl)} por dia` : "";
    if (key === "nutrition") return target.nutrition;
    if (key === "supplement") return target.supplement;
    return "";
  };

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meus hábitos</h1>
        <p className="mt-1 text-sm text-ink-400">
          Registro de hábitos para acompanhamento. Não substitui prescrição nutricional.
        </p>
      </header>

      <Card>
        <SectionTitle>Hoje</SectionTitle>
        <p className="-mt-1 mb-3 text-xs text-ink-500">
          Toque uma vez se cumpriu, duas se não cumpriu, três para limpar.
        </p>
        <div className="space-y-2">
          {HABITS.map((h) => {
            const estado: HabitStatus = logs.get(today)?.[h.key] ?? 0;
            const e = ESTILO[estado];
            const orientacao = meta(h.key);
            return (
              <form key={h.key} action={toggleHabitAction}>
                <input type="hidden" name="date" value={today} />
                <input type="hidden" name="field" value={h.key} />
                <button
                  type="submit"
                  aria-label={`${h.label}: ${e.leitura}`}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left ${e.botao}`}
                >
                  <span className="text-xl leading-6">{h.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink-100">{h.label}</span>
                    {orientacao && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-400">
                        {orientacao}
                      </span>
                    )}
                  </span>
                  <span className={e.bolha}>{e.marca}</span>
                </button>
              </form>
            );
          })}
        </div>
        {!target && (
          <p className="mt-3 text-xs text-ink-500">
            Seu personal ainda não cadastrou metas. Você pode marcar assim mesmo.
          </p>
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-3">
          <SectionTitle>Sua semana</SectionTitle>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-500">
                <th className="pb-2 text-left" />
                {days.map((d) => (
                  <th key={d} className="pb-2 text-center">
                    {WEEKDAY_LABELS[new Date(`${d}T12:00:00`).getDay()]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HABITS.map((h) => (
                <tr key={h.key} className="border-t border-ink-850">
                  <td className="py-2.5 pr-2 text-lg">{h.icon}</td>
                  {days.map((d) => {
                    const estado: HabitStatus = logs.get(d)?.[h.key] ?? 0;
                    const cor =
                      estado === 1
                        ? "bg-lime-accent"
                        : estado === 2
                          ? "bg-danger"
                          : d > today
                            ? "border border-ink-800"
                            : "bg-ink-800";
                    return (
                      <td key={d} className="py-2.5 text-center">
                        <span
                          title={`${h.label} em ${formatShortDate(d)}: ${ESTILO[estado].leitura}`}
                          className={`inline-block size-4 rounded-md ${cor}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ink-500">
            <span className="mr-1 inline-block size-2.5 rounded bg-lime-accent align-middle" /> cumpriu
            <span className="ml-3 mr-1 inline-block size-2.5 rounded bg-danger align-middle" /> não cumpriu
            <span className="ml-3 mr-1 inline-block size-2.5 rounded bg-ink-800 align-middle" /> sem resposta
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Consistência dos últimos 7 dias</SectionTitle>
        <ul className="space-y-3">
          {HABITS.map((h) => {
            // Só entram no cálculo os dias respondidos: um dia em branco não é
            // falha, e contá-lo como tal faria a barra despencar sozinha.
            const respondidos = days.filter((d) => d <= today && (logs.get(d)?.[h.key] ?? 0) !== 0);
            const cumpridos = respondidos.filter((d) => logs.get(d)?.[h.key] === 1).length;
            const pct = respondidos.length ? Math.round((cumpridos / respondidos.length) * 100) : 0;
            return (
              <li key={h.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-300">
                    {h.icon} {h.label}
                  </span>
                  <span className="tabular-nums text-ink-400">
                    {respondidos.length ? `${pct}%` : "—"}
                  </span>
                </div>
                <Progress className="mt-1.5" value={pct} tone={toneForScore(pct)} />
                {respondidos.length > 0 && (
                  <p className="mt-1 text-[11px] text-ink-500">
                    {cumpridos} de {respondidos.length} dias respondidos
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
