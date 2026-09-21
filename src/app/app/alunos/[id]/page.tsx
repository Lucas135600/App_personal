import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePersonal } from "@/lib/auth";
import { buildStudentView } from "@/lib/queries";
import { Avatar, Badge, cx } from "@/components/ui";
import { MODALITY_LABEL } from "@/lib/labels";
import { currentMonth, formatDate, relativeDays } from "@/lib/dates";
import {
  AnamnesisTab, AssessmentsTab, CheckinsTab, EvolutionTab, HabitsTab,
  HistoryTab, OverviewTab, WorkoutsTab,
} from "./tabs";

const TABS = [
  { key: "visao-geral", label: "Visão geral" },
  { key: "treinos", label: "Treinos" },
  { key: "checkins", label: "Check-ins" },
  { key: "avaliacoes", label: "Avaliações" },
  { key: "evolucao", label: "Evolução" },
  { key: "anamnese", label: "Anamnese" },
  { key: "habitos", label: "Hábitos" },
  { key: "historico", label: "Histórico" },
];

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; mes?: string }>;
}) {
  const pro = await requirePersonal();
  const { id } = await params;
  const { tab = "visao-geral", mes } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : currentMonth();

  const view = buildStudentView(id);
  if (!view || view.student.professionalId !== pro.id) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6 lb-enter">
      <div>
        <Link href="/app/alunos" className="text-xs font-semibold text-ink-400 hover:text-ink-200">
          &larr; Alunos
        </Link>
      </div>

      <header className="flex flex-wrap items-center gap-4 rounded-[18px] border border-ink-800 bg-ink-900 p-5">
        <Avatar name={view.user.name} color={view.user.avatarColor} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">{view.user.name}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {view.age} anos &middot; {MODALITY_LABEL[view.student.modality]} &middot; {view.student.goal}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Aluno desde {formatDate(view.student.startDate)} &middot; último treino {relativeDays(view.lastSessionDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {view.alerts.length ? (
            view.alerts.map((a) => (
              <Badge key={a.label} tone={a.level === "danger" ? "danger" : "warn"}>
                {a.label}
              </Badge>
            ))
          ) : (
            <Badge tone="ok">Tudo em dia</Badge>
          )}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-ink-800 pb-px">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/alunos/${id}?tab=${t.key}`}
            className={cx(
              "shrink-0 rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition-colors",
              t.key === tab
                ? "border-b-2 border-lime-accent text-ink-100"
                : "text-ink-400 hover:text-ink-200",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "visao-geral" && <OverviewTab view={view} />}
      {tab === "treinos" && <WorkoutsTab view={view} />}
      {tab === "checkins" && <CheckinsTab view={view} />}
      {tab === "avaliacoes" && <AssessmentsTab view={view} />}
      {tab === "evolucao" && <EvolutionTab view={view} />}
      {tab === "anamnese" && <AnamnesisTab view={view} />}
      {tab === "habitos" && <HabitsTab view={view} />}
      {tab === "historico" && <HistoryTab view={view} month={month} />}
    </div>
  );
}
