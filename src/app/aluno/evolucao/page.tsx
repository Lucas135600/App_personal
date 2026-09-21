import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildStudentView, measurementSeries, weeklyFrequency, weightSeries } from "@/lib/queries";
import { currentMonth, formatMonth, formatShortDate } from "@/lib/dates";
import { LineChart, TargetBars } from "@/components/charts";
import { PhotoCompare } from "@/components/photo-compare";
import { Card, SectionTitle, Stat } from "@/components/ui";
import { PhotoUploader } from "./photo-uploader";

const ANGLES = ["frente", "lateral", "costas"] as const;

export default async function StudentEvolutionPage() {
  const { student } = await requireStudent();
  const view = buildStudentView(student.id)!;
  const db = getDb();

  const months = Array.from(
    new Set([...view.photoMonths, currentMonth()]),
  ).sort();

  const photoMonths = months.map((month) => ({
    month,
    slots: ANGLES.map((angle) => ({
      angle,
      fileName:
        db.progressPhotos.find(
          (p) => p.studentId === student.id && p.month === month && p.angle === angle,
        )?.fileName ?? null,
    })),
  }));

  const thisMonthSlots = photoMonths.find((m) => m.month === currentMonth())!;
  const freq = weeklyFrequency(student.id, 8).map((p) => ({
    label: formatShortDate(p.weekStart),
    done: p.done,
    planned: p.planned,
  }));

  const a = view.lastAssessment;
  const first = view.firstAssessment;

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Minha evolução</h1>
        <p className="mt-1 text-sm text-ink-400">Números, medidas e fotos do seu processo.</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Peso"
          value={view.weight != null ? `${view.weight} kg` : "--"}
          sub={view.weightDelta != null ? `${view.weightDelta > 0 ? "+" : ""}${view.weightDelta} kg` : undefined}
          tone={view.weightDelta != null && view.weightDelta < 0 ? "ok" : "neutral"}
        />
        <Stat
          label="Cintura"
          value={a?.measurements.cintura != null ? `${a.measurements.cintura} cm` : "--"}
          sub={
            view.waistDelta != null
              ? `${view.waistDelta > 0 ? "+" : ""}${view.waistDelta} cm desde ${first ? formatMonth(first.date.slice(0, 7)) : "o início"}`
              : undefined
          }
          tone={view.waistDelta != null && view.waistDelta < 0 ? "ok" : "neutral"}
        />
        <Stat label="Frequência" value={`${view.frequency}%`} sub="últimas 4 semanas" />
        <Stat label="Treinos" value={view.doneLast4Weeks} sub="nas últimas 4 semanas" />
      </div>

      <Card>
        <LineChart
          points={weightSeries(student.id)}
          unit=" kg"
          label="Peso"
          invertGood={student.goal === "Emagrecimento"}
        />
      </Card>

      <Card>
        <LineChart points={measurementSeries(student.id, "cintura")} unit=" cm" label="Cintura" invertGood />
      </Card>

      <Card>
        <TargetBars data={freq} label="Treinos por semana" />
      </Card>

      <section>
        <SectionTitle>Foto do mês - {formatMonth(currentMonth())}</SectionTitle>
        <PhotoUploader month={currentMonth()} slots={thisMonthSlots.slots} />
      </section>

      <section>
        <SectionTitle>Comparar</SectionTitle>
        <Card>
          <PhotoCompare months={photoMonths} />
        </Card>
      </section>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-ink-600">
        Suas fotos são privadas. Somente você e o Lucas têm acesso, e cada visualização passa por
        autenticação.
      </p>
    </div>
  );
}
