import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { estadoConsentimento } from "@/lib/consent";
import { buildStudentView, measurementSeries, weeklyFrequency, weightSeries } from "@/lib/queries";
import { currentMonth, formatMonth, formatShortDate } from "@/lib/dates";
import { LineChart, TargetBars } from "@/components/charts";
import { PhotoCompare } from "@/components/photo-compare";
import { Card, SectionTitle, Stat } from "@/components/ui";
import { PhotoUploader } from "./photo-uploader";

const ANGLES = ["frente", "lateral", "costas"] as const;

export default async function StudentEvolutionPage() {
  const { student } = await requireStudent();
  const view = (await buildStudentView(student.id))!;
  const db = await getDb();

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
  const podeFoto = estadoConsentimento(db, student.id).imagem;
  const temFoto = photoMonths.some((m) => m.slots.some((s) => s.fileName));
  const freq = (await weeklyFrequency(student.id, 8)).map((p) => ({
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
          points={await weightSeries(student.id)}
          unit=" kg"
          label="Peso"
          invertGood={student.goal === "Emagrecimento"}
        />
      </Card>

      <Card>
        <LineChart points={await measurementSeries(student.id, "cintura")} unit=" cm" label="Cintura" invertGood />
      </Card>

      <Card>
        <TargetBars data={freq} label="Treinos por semana" />
      </Card>

      {/* Sem a autorização de imagem não existe envio de foto — nem o campo.
          Deixar o formulário na tela e recusar depois seria pedir a foto de
          quem já disse que não queria enviar. */}
      <section>
        <SectionTitle>Foto do mês - {formatMonth(currentMonth())}</SectionTitle>
        {podeFoto ? (
          <PhotoUploader month={currentMonth()} slots={thisMonthSlots.slots} />
        ) : (
          <Card>
            <p className="text-sm leading-relaxed text-ink-300">
              Você não autorizou o uso de fotos para avaliação, então esta parte fica
              desligada. O resto do acompanhamento funciona normalmente.
            </p>
            <Link
              href="/aluno/perfil"
              className="mt-3 inline-block text-sm font-semibold text-lime-accent"
            >
              Mudar essa autorização no perfil
            </Link>
          </Card>
        )}
      </section>

      {podeFoto && temFoto && (
        <section>
          <SectionTitle>Comparar</SectionTitle>
          <Card>
            <PhotoCompare months={photoMonths} />
          </Card>
        </section>
      )}

      <p className="pb-2 text-center text-[11px] leading-relaxed text-ink-600">
        Suas fotos são privadas. Somente você e o Lucas têm acesso, e cada visualização passa por
        autenticação.
      </p>
    </div>
  );
}
