import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { GOALS, montarDesafio, resumoDoDesafio } from "@/lib/challenges";
import { cancelChallengeAction, leaveChallengeAction, respondChallengeAction } from "@/lib/actions/student";
import { formatShortDate, todayISO } from "@/lib/dates";
import { Avatar, Badge, Button, Card, SectionTitle } from "@/components/ui";
import { EntryForm } from "./entry-form";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student } = await requireStudent();
  const db = await getDb();

  const view = montarDesafio(db, id);
  // getDb já vem limitado ao profissional da sessão, então um id de outro
  // personal simplesmente não existe aqui — 404, não 403.
  if (!view) notFound();

  const { challenge: c, ranking, encerrado, diasRestantes, futuro } = view;
  const eu = view.membros.find((m) => m.studentId === student.id);
  if (!eu) notFound();

  const def = GOALS[c.goal];
  const hoje = todayISO();
  const souAutor = c.createdBy === student.id;

  const minhasEntradas = db.challengeEntries
    .filter((e) => e.challengeId === c.id && e.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const hojeEntrada = minhasEntradas.find((e) => e.date === hoje) ?? null;

  const registros = db.challengeEntries
    .filter((e) => e.challengeId === c.id && e.photoFileName)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  const unidadePontos =
    c.period === "total" ? def.unidade : c.period === "diario" ? "dias" : "semanas";

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <Link href="/aluno/desafios" className="text-xs font-semibold text-ink-400">
          ← Desafios
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{c.name}</h1>
        <p className="mt-1 text-sm text-ink-400">
          {c.kind === "duelo" ? "Duelo" : "Grupo"} · {resumoDoDesafio(c)}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          {formatShortDate(c.startDate)} a {formatShortDate(c.endDate)} ·{" "}
          {encerrado ? "encerrado" : futuro ? "ainda não começou" : `faltam ${diasRestantes} dias`}
        </p>
      </header>

      {eu.status === "convidado" && (
        <Card>
          <p className="text-sm font-semibold text-ink-100">Você foi convidado</p>
          {c.requirePhoto && (
            <p className="mt-1 text-xs leading-relaxed text-warn">
              Este desafio exige foto em cada registro, e ela fica visível para os outros
              participantes.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <form action={respondChallengeAction} className="flex-1">
              <input type="hidden" name="challengeId" value={c.id} />
              <input type="hidden" name="resposta" value="aceitar" />
              <Button type="submit" size="sm" className="w-full">Aceitar</Button>
            </form>
            <form action={respondChallengeAction} className="flex-1">
              <input type="hidden" name="challengeId" value={c.id} />
              <input type="hidden" name="resposta" value="recusar" />
              <Button type="submit" size="sm" variant="outline" className="w-full">Recusar</Button>
            </form>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Placar</SectionTitle>
        {ranking.length === 0 ? (
          <p className="text-sm text-ink-500">Ninguém aceitou ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {ranking.map((r) => (
              <li
                key={r.studentId}
                className={
                  r.studentId === student.id
                    ? "flex items-center gap-3 rounded-xl border border-lime-accent/40 bg-lime-accent/[0.07] px-3 py-2.5"
                    : "flex items-center gap-3 rounded-xl bg-ink-850 px-3 py-2.5"
                }
              >
                <span
                  className={
                    r.posicao === 1
                      ? "w-5 shrink-0 text-center text-sm font-extrabold text-lime-accent"
                      : "w-5 shrink-0 text-center text-sm font-bold text-ink-500"
                  }
                >
                  {r.posicao}
                </span>
                <Avatar name={r.nome} color={r.avatarColor} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-100">
                    {r.nome}
                    {r.studentId === student.id && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-lime-accent">
                        você
                      </span>
                    )}
                  </span>
                  {c.period !== "total" && (
                    <span className="block text-[11px] text-ink-500">
                      {def.decimal ? r.total.toFixed(1).replace(".", ",") : Math.round(r.total)}{" "}
                      {def.unidade} no total
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-base font-extrabold tabular-nums text-ink-100">
                    {def.decimal && c.period === "total"
                      ? r.pontos.toFixed(1).replace(".", ",")
                      : Math.round(r.pontos)}
                  </span>
                  <span className="block text-[10px] text-ink-500">{unidadePontos}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {eu.status === "aceito" && !def.automatico && !encerrado && !futuro && (
        <Card>
          <SectionTitle>Registrar hoje</SectionTitle>
          <EntryForm
            challengeId={c.id}
            hoje={hoje}
            unidade={def.unidade}
            decimal={def.decimal}
            requirePhoto={c.requirePhoto}
            jaTemFoto={Boolean(hojeEntrada?.photoFileName)}
            valorAtual={hojeEntrada ? hojeEntrada.value : null}
          />
        </Card>
      )}

      {eu.status === "aceito" && def.automatico && !encerrado && (
        <Card>
          <p className="text-sm leading-relaxed text-ink-400">
            Este desafio conta sozinho: cada{" "}
            {c.goal === "treinos" ? "treino que você finaliza" : "hábito que você marca"} vira
            ponto. Não há nada para registrar aqui.
          </p>
        </Card>
      )}

      {registros.length > 0 && (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionTitle>Comprovações</SectionTitle>
            <p className="-mt-1 text-xs text-ink-500">
              Fotos enviadas pelos participantes deste desafio.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 px-5 pb-5">
            {registros.map((e) => {
              const st = db.students.find((s) => s.id === e.studentId);
              const u = st ? db.users.find((x) => x.id === st.userId) : undefined;
              return (
                <figure key={e.id} className="m-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/foto/${encodeURIComponent(e.photoFileName)}`}
                    alt={`Registro de ${u?.name ?? "aluno"} em ${formatShortDate(e.date)}`}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                  <figcaption className="mt-1 truncate text-[10px] text-ink-500">
                    {(u?.name ?? "Aluno").split(" ")[0]} · {formatShortDate(e.date)}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </Card>
      )}

      {minhasEntradas.length > 0 && (
        <Card>
          <SectionTitle>Seus registros</SectionTitle>
          <ul className="space-y-1">
            {minhasEntradas.slice(0, 10).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border-b border-ink-850 py-2 text-sm last:border-0"
              >
                <span className="text-ink-400">{formatShortDate(e.date)}</span>
                <span className="flex items-center gap-2">
                  {e.photoFileName && <Badge tone="ok">foto</Badge>}
                  <span className="font-semibold tabular-nums text-ink-100">
                    {def.decimal ? String(e.value).replace(".", ",") : Math.round(e.value)}{" "}
                    {def.unidade}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {eu.status === "aceito" && !encerrado && (
        <div className="flex gap-2">
          {souAutor ? (
            <form action={cancelChallengeAction} className="flex-1">
              <input type="hidden" name="challengeId" value={c.id} />
              <Button type="submit" variant="ghost" size="sm" className="w-full">
                Cancelar desafio
              </Button>
            </form>
          ) : (
            <form action={leaveChallengeAction} className="flex-1">
              <input type="hidden" name="challengeId" value={c.id} />
              <Button type="submit" variant="ghost" size="sm" className="w-full">
                Sair do desafio
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
