import { requirePersonal } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { GOALS, montarDesafio, resumoDoDesafio } from "@/lib/challenges";
import { formatShortDate } from "@/lib/dates";
import { Avatar, Badge, Card, EmptyState, SectionTitle, Stat } from "@/components/ui";

export default async function CoachChallengesPage() {
  await requirePersonal();
  const db = await getDb();

  const views = db.challenges
    .map((c) => montarDesafio(db, c.id))
    .filter((v): v is NonNullable<typeof v> => v !== null && v.challenge.status === "ativo")
    .sort((a, b) => Number(a.encerrado) - Number(b.encerrado) || a.challenge.endDate.localeCompare(b.challenge.endDate));

  const ativos = views.filter((v) => !v.encerrado);
  const comFoto = views.filter((v) => v.challenge.requirePhoto).length;
  const participantes = new Set(
    db.challengeMembers.filter((m) => m.status === "aceito").map((m) => m.studentId),
  ).size;

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Desafios</h1>
        <p className="mt-1 text-sm text-ink-400">
          Disputas criadas pelos seus alunos. Você acompanha; quem cria e participa são eles.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Em andamento" value={String(ativos.length)} />
        <Stat label="Alunos jogando" value={String(participantes)} />
        <Stat label="Exigem foto" value={String(comFoto)} />
      </div>

      {views.length === 0 ? (
        <EmptyState
          title="Nenhum desafio ainda"
          description="Os alunos criam os desafios pelo aplicativo, na aba Desafios. Só aparecem aqui alunos com o perfil visível."
        />
      ) : (
        <div className="space-y-3">
          {views.map((v) => {
            const c = v.challenge;
            const def = GOALS[c.goal];
            const unidade =
              c.period === "total" ? def.unidade : c.period === "diario" ? "dias" : "semanas";
            return (
              <Card key={c.id}>
                <SectionTitle
                  action={
                    <Badge tone={v.encerrado ? "neutral" : v.diasRestantes <= 2 ? "warn" : "accent"}>
                      {v.encerrado ? "encerrado" : `${v.diasRestantes} dias`}
                    </Badge>
                  }
                >
                  {c.name}
                </SectionTitle>
                <p className="-mt-1 mb-3 text-xs text-ink-500">
                  {c.kind === "duelo" ? "Duelo" : "Grupo"} · {resumoDoDesafio(c)} ·{" "}
                  {formatShortDate(c.startDate)} a {formatShortDate(c.endDate)}
                  {c.requirePhoto && " · com foto"}
                </p>

                <ul className="space-y-1">
                  {v.ranking.map((r) => (
                    <li
                      key={r.studentId}
                      className="flex items-center gap-3 rounded-lg bg-ink-850 px-3 py-2"
                    >
                      <span className="w-4 text-center text-xs font-bold text-ink-500">{r.posicao}</span>
                      <Avatar name={r.nome} color={r.avatarColor} size={26} />
                      <span className="flex-1 truncate text-sm text-ink-200">{r.nome}</span>
                      <span className="text-sm font-bold tabular-nums text-ink-100">
                        {def.decimal && c.period === "total"
                          ? r.pontos.toFixed(1).replace(".", ",")
                          : Math.round(r.pontos)}{" "}
                        <span className="text-[10px] font-medium text-ink-500">{unidade}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
