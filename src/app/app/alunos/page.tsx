import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { listStudentViews } from "@/lib/queries";
import { relativeDays } from "@/lib/dates";
import { Avatar, Badge, Card, EmptyState, LinkButton, Progress, toneForScore } from "@/components/ui";
import { MODALITY_LABEL } from "@/lib/labels";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "presencial", label: "Presencial" },
  { key: "online", label: "Online" },
  { key: "hibrido", label: "Híbrido" },
  { key: "checkin", label: "Check-in pendente" },
  { key: "frequencia", label: "Baixa frequência" },
  { key: "avaliacao", label: "Avaliação pendente" },
];

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const pro = await requirePersonal();
  const { f = "todos", q = "" } = await searchParams;
  const all = listStudentViews(pro.id);

  const filtered = all.filter((v) => {
    if (q && !v.user.name.toLowerCase().includes(q.toLowerCase())) return false;
    switch (f) {
      case "presencial":
      case "online":
      case "hibrido":
        return v.student.modality === f;
      case "checkin":
        return v.currentCheckin?.status !== "respondido";
      case "frequencia":
        return v.frequency < 70;
      case "avaliacao":
        return v.alerts.some((a) => a.label.startsWith("Avaliação"));
      default:
        return true;
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 lb-enter">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="mt-1 text-sm text-ink-400">
            {filtered.length} de {all.length} alunos
          </p>
        </div>
        <LinkButton href="/app/alunos/novo">+ Novo aluno</LinkButton>
      </header>

      <form className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome"
          className="w-full max-w-xs rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2 text-sm outline-none placeholder:text-ink-500 focus:border-lime-accent"
        />
        <input type="hidden" name="f" value={f} />
        <button className="rounded-xl bg-ink-800 px-3.5 py-2 text-sm font-semibold text-ink-200">
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/app/alunos?f=${item.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={
              item.key === f
                ? "rounded-full bg-lime-accent px-3.5 py-1.5 text-xs font-semibold text-ink-950"
                : "rounded-full border border-ink-700 px-3.5 py-1.5 text-xs font-semibold text-ink-300 hover:border-ink-500"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum aluno neste filtro" description="Ajuste os filtros ou cadastre um novo aluno." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <Card key={v.student.id} className="transition-colors hover:border-ink-600">
              <Link href={`/app/alunos/${v.student.id}`} className="block">
                <div className="flex items-center gap-3">
                  <Avatar name={v.user.name} color={v.user.avatarColor} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-100">{v.user.name}</p>
                    <p className="text-xs text-ink-400">
                      {v.age} anos &middot; {MODALITY_LABEL[v.student.modality]}
                    </p>
                  </div>
                  <Badge tone="accent">{v.student.goal.split(" ")[0]}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-ink-850 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ink-500">Freq.</dt>
                    <dd className="text-sm font-bold tabular-nums">{v.frequency}%</dd>
                  </div>
                  <div className="rounded-xl bg-ink-850 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ink-500">Peso</dt>
                    <dd className="text-sm font-bold tabular-nums">{v.weight ?? "--"}</dd>
                  </div>
                  <div className="rounded-xl bg-ink-850 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ink-500">Adesão</dt>
                    <dd className="text-sm font-bold tabular-nums">{v.adherence.overall}%</dd>
                  </div>
                </dl>

                <Progress className="mt-3" value={v.adherence.overall} tone={toneForScore(v.adherence.overall)} />

                <p className="mt-3 text-xs text-ink-500">Último treino {relativeDays(v.lastSessionDate)}</p>

                {v.alerts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {v.alerts.slice(0, 2).map((a) => (
                      <Badge key={a.label} tone={a.level === "danger" ? "danger" : "warn"}>
                        {a.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
