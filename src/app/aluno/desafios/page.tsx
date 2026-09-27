import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { desafiosDoAluno, GOALS, resumoDoDesafio, type DesafioView } from "@/lib/challenges";
import { respondChallengeAction } from "@/lib/actions/student";
import { formatShortDate } from "@/lib/dates";
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui";

/** "1 dia" e não "1 dias" — o texto aparece o tempo todo e o erro salta. */
function unidadeDe(c: DesafioView["challenge"], pontos: number): string {
  if (c.period === "total") {
    const n = GOALS[c.goal].decimal ? pontos.toFixed(1).replace(".", ",") : Math.round(pontos);
    return `${n} ${GOALS[c.goal].unidade}`;
  }
  const n = Math.round(pontos);
  const palavra = c.period === "diario" ? "dia" : "semana";
  return `${n} ${palavra}${n === 1 ? "" : "s"}`;
}

function Faixa({ view }: { view: DesafioView }) {
  const { challenge: c, ranking, diasRestantes, encerrado } = view;
  const lider = ranking[0];

  return (
    <Link
      href={`/aluno/desafios/${c.id}`}
      className="block rounded-[18px] border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink-100">{c.name}</p>
          <p className="mt-0.5 text-xs text-ink-400">
            {c.kind === "duelo" ? "Duelo" : `Grupo · ${ranking.length} participantes`} ·{" "}
            {resumoDoDesafio(c)}
          </p>
        </div>
        <Badge tone={encerrado ? "neutral" : diasRestantes <= 2 ? "warn" : "accent"}>
          {encerrado
            ? "encerrado"
            : diasRestantes === 0
              ? "último dia"
              : `${diasRestantes} dias`}
        </Badge>
      </div>

      {lider && (
        <div className="mt-3 flex items-center gap-2 border-t border-ink-850 pt-3">
          <Avatar name={lider.nome} color={lider.avatarColor} size={26} />
          <span className="text-xs text-ink-300">
            <strong className="text-ink-100">{lider.nome.split(" ")[0]}</strong>{" "}
            {encerrado ? "venceu" : "lidera"} com {unidadeDe(c, lider.pontos)}
          </span>
        </div>
      )}
    </Link>
  );
}

export default async function ChallengesPage() {
  const { student } = await requireStudent();
  const db = await getDb();
  const { convites, ativos, encerrados } = desafiosDoAluno(db, student.id);

  return (
    <div className="space-y-5 lb-enter">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Desafios</h1>
          <p className="mt-1 text-sm text-ink-400">
            Dispute com quem treina com o mesmo personal.
          </p>
        </div>
        <Link
          href="/aluno/desafios/novo"
          className="shrink-0 rounded-xl bg-lime-accent px-3.5 py-2 text-sm font-bold text-ink-950"
        >
          Criar
        </Link>
      </header>

      {convites.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Convites</SectionTitle>
          {convites.map(({ view }) => (
            <Card key={view.challenge.id}>
              <p className="text-[15px] font-bold text-ink-100">{view.challenge.name}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {view.challenge.kind === "duelo" ? "Duelo" : "Grupo"} · {resumoDoDesafio(view.challenge)} ·
                até {formatShortDate(view.challenge.endDate)}
              </p>
              {view.challenge.requirePhoto && (
                <p className="mt-2 text-xs text-warn">Exige foto para validar cada registro.</p>
              )}
              <div className="mt-3 flex gap-2">
                <form action={respondChallengeAction} className="flex-1">
                  <input type="hidden" name="challengeId" value={view.challenge.id} />
                  <input type="hidden" name="resposta" value="aceitar" />
                  <Button type="submit" size="sm" className="w-full">Aceitar</Button>
                </form>
                <form action={respondChallengeAction} className="flex-1">
                  <input type="hidden" name="challengeId" value={view.challenge.id} />
                  <input type="hidden" name="resposta" value="recusar" />
                  <Button type="submit" size="sm" variant="outline" className="w-full">Recusar</Button>
                </form>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>Em andamento</SectionTitle>
        {ativos.length === 0 ? (
          <EmptyState
            title="Nenhum desafio ativo"
            description="Crie um duelo com alguém ou monte um grupo. Vale treino, hábito, cardio, abdominais ou corrida."
          />
        ) : (
          ativos.map(({ view }) => <Faixa key={view.challenge.id} view={view} />)
        )}
      </section>

      {encerrados.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Encerrados</SectionTitle>
          {encerrados.slice(0, 5).map(({ view }) => <Faixa key={view.challenge.id} view={view} />)}
        </section>
      )}
    </div>
  );
}
