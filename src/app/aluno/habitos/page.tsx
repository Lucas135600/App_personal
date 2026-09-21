import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { toggleHabitAction } from "@/lib/actions/student";
import { currentWeekStart, formatShortDate, todayISO, WEEKDAY_LABELS, weekDays } from "@/lib/dates";
import { Card, Progress, SectionTitle, toneForScore } from "@/components/ui";

const HABITS: Array<{ key: "water" | "nutrition" | "sleep" | "steps" | "supplement"; label: string; icon: string }> = [
  { key: "water", label: "Água", icon: "💧" },
  { key: "nutrition", label: "Alimentação", icon: "🥗" },
  { key: "sleep", label: "Sono", icon: "😴" },
  { key: "steps", label: "Passos", icon: "🚶" },
  { key: "supplement", label: "Suplemento", icon: "💊" },
];

export default async function HabitsPage() {
  const { student } = await requireStudent();
  const db = getDb();
  const days = weekDays(currentWeekStart());
  const today = todayISO();

  const logs = new Map(
    db.habitLogs.filter((h) => h.studentId === student.id).map((h) => [h.date, h]),
  );

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
        <div className="space-y-2">
          {HABITS.map((h) => {
            const done = logs.get(today)?.[h.key] ?? false;
            return (
              <form key={h.key} action={toggleHabitAction}>
                <input type="hidden" name="date" value={today} />
                <input type="hidden" name="field" value={h.key} />
                <button
                  type="submit"
                  className={
                    done
                      ? "flex w-full items-center gap-3 rounded-xl border border-lime-accent/40 bg-lime-accent/10 px-4 py-3 text-left"
                      : "flex w-full items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 px-4 py-3 text-left"
                  }
                >
                  <span className="text-xl">{h.icon}</span>
                  <span className="flex-1 text-sm font-semibold text-ink-100">{h.label}</span>
                  <span
                    className={
                      done
                        ? "flex size-6 items-center justify-center rounded-full bg-lime-accent text-xs font-bold text-ink-950"
                        : "size-6 rounded-full border border-ink-600"
                    }
                  >
                    {done ? "✓" : ""}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
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
                  {days.map((d) => (
                    <td key={d} className="py-2.5 text-center">
                      <span
                        title={`${h.label} em ${formatShortDate(d)}`}
                        className={
                          logs.get(d)?.[h.key]
                            ? "inline-block size-4 rounded-md bg-lime-accent"
                            : d > today
                              ? "inline-block size-4 rounded-md border border-ink-800"
                              : "inline-block size-4 rounded-md bg-ink-800"
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Consistência dos últimos 7 dias</SectionTitle>
        <ul className="space-y-3">
          {HABITS.map((h) => {
            const hits = days.filter((d) => d <= today && logs.get(d)?.[h.key]).length;
            const possible = days.filter((d) => d <= today).length || 1;
            const pct = Math.round((hits / possible) * 100);
            return (
              <li key={h.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-300">
                    {h.icon} {h.label}
                  </span>
                  <span className="tabular-nums text-ink-400">{pct}%</span>
                </div>
                <Progress className="mt-1.5" value={pct} tone={toneForScore(pct)} />
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
