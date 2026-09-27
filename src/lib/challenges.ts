import { todayISO, weekStart } from "./dates";
import type {
  Challenge, ChallengeGoal, ChallengeMember, ChallengePeriod, Database,
} from "./types";

/* Desafios entre alunos.
 *
 * A decisão que define o módulo: o placar NÃO é guardado, é calculado toda vez
 * a partir dos registros e dos treinos que já existem. Um contador gravado
 * viraria uma segunda verdade, que ficaria errada em silêncio assim que um
 * registro fosse corrigido — e ninguém descobriria até alguém reclamar de ter
 * perdido injustamente.
 */

export interface DefGoal {
  label: string;
  /** Como o valor é escrito ao lado do número. */
  unidade: string;
  /** Automático = o app mede sozinho, o aluno não registra nada. */
  automatico: boolean;
  /** Sugestão de meta ao criar, por período. */
  sugestao: number;
  /** Aceita fração (km) ou só inteiro (repetições, minutos). */
  decimal: boolean;
  exemplo: string;
}

export const GOALS: Record<ChallengeGoal, DefGoal> = {
  treinos: {
    label: "Treinos concluídos", unidade: "treinos", automatico: true,
    sugestao: 4, decimal: false,
    exemplo: "Conta sozinho cada treino que você finaliza no app.",
  },
  habitos: {
    label: "Hábitos cumpridos", unidade: "hábitos", automatico: true,
    sugestao: 20, decimal: false,
    exemplo: "Conta sozinho cada hábito que você marca como cumprido.",
  },
  cardio_min: {
    label: "Minutos de cardio", unidade: "min", automatico: false,
    sugestao: 30, decimal: false,
    exemplo: "Ex.: 30 minutos por dia.",
  },
  abdominais: {
    label: "Abdominais", unidade: "reps", automatico: false,
    sugestao: 100, decimal: false,
    exemplo: "Ex.: 100 repetições por dia.",
  },
  corrida_km: {
    label: "Corrida", unidade: "km", automatico: false,
    sugestao: 5, decimal: true,
    exemplo: "Ex.: 5 km por dia, ou 20 km na semana.",
  },
};

export const PERIODOS: Record<ChallengePeriod, string> = {
  diario: "Por dia",
  semanal: "Por semana",
  total: "No total",
};

/** Como o desafio se descreve numa linha. */
export function resumoDoDesafio(c: Challenge): string {
  const g = GOALS[c.goal];
  if (c.period === "total") return `Maior total de ${g.label.toLowerCase()}`;
  const alvo = g.decimal ? String(c.target).replace(".", ",") : String(Math.round(c.target));
  return `${alvo} ${g.unidade} ${c.period === "diario" ? "por dia" : "por semana"}`;
}

export interface Colocacao {
  studentId: string;
  nome: string;
  avatarColor: string;
  /** O que ordena: períodos batidos, ou o total quando period = 'total'. */
  pontos: number;
  /** Soma bruta no intervalo, sempre exibida como apoio. */
  total: number;
  posicao: number;
}

export interface DesafioView {
  challenge: Challenge;
  membros: ChallengeMember[];
  ranking: Colocacao[];
  diasRestantes: number;
  encerrado: boolean;
  futuro: boolean;
}

function diasEntre(de: string, ate: string): number {
  const a = new Date(`${de}T12:00:00`).getTime();
  const b = new Date(`${ate}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

type DbParaPlacar = Pick<
  Database,
  "workoutSessions" | "habitLogs" | "challengeEntries" | "challenges" | "challengeMembers" | "students" | "users"
>;

/** O valor do aluno em cada dia do intervalo, conforme a meta do desafio. */
function porDia(
  db: DbParaPlacar,
  challenge: Challenge,
  studentId: string,
  ate: string,
): Map<string, number> {
  const mapa = new Map<string, number>();
  const soma = (dia: string, v: number) => mapa.set(dia, (mapa.get(dia) ?? 0) + v);
  const dentro = (dia: string) => dia >= challenge.startDate && dia <= ate;

  if (challenge.goal === "treinos") {
    for (const s of db.workoutSessions) {
      if (s.studentId !== studentId || !s.finishedAt) continue;
      const dia = s.startedAt.slice(0, 10);
      if (dentro(dia)) soma(dia, 1);
    }
    return mapa;
  }

  if (challenge.goal === "habitos") {
    for (const h of db.habitLogs) {
      if (h.studentId !== studentId || !dentro(h.date)) continue;
      // marcar "não cumpri" não pontua nem penaliza: a régua é o que foi feito
      soma(h.date, [h.water, h.nutrition, h.sleep, h.steps, h.supplement].filter((v) => v === 1).length);
    }
    return mapa;
  }

  for (const e of db.challengeEntries) {
    if (e.challengeId !== challenge.id || e.studentId !== studentId || !dentro(e.date)) continue;
    soma(e.date, e.value);
  }
  return mapa;
}

/** Pontos de ordenação e total bruto. */
export function placarDe(
  db: DbParaPlacar,
  challenge: Challenge,
  studentId: string,
  ate: string,
): { pontos: number; total: number } {
  const dias = porDia(db, challenge, studentId, ate);
  const total = [...dias.values()].reduce((a, b) => a + b, 0);

  if (challenge.period === "total" || challenge.target <= 0) {
    return { pontos: Math.round(total * 100) / 100, total };
  }

  if (challenge.period === "diario") {
    const batidos = [...dias.values()].filter((v) => v >= challenge.target).length;
    return { pontos: batidos, total };
  }

  // semanal: agrupa por segunda-feira e conta as semanas que bateram a meta
  const semanas = new Map<string, number>();
  for (const [dia, v] of dias) {
    const ini = weekStart(dia);
    semanas.set(ini, (semanas.get(ini) ?? 0) + v);
  }
  return {
    pontos: [...semanas.values()].filter((v) => v >= challenge.target).length,
    total,
  };
}

export function montarDesafio(db: DbParaPlacar, challengeId: string): DesafioView | null {
  const challenge = db.challenges.find((c) => c.id === challengeId);
  if (!challenge) return null;

  const membros = db.challengeMembers.filter((m) => m.challengeId === challengeId);
  const hoje = todayISO();
  // Contar o período inteiro mostraria pontuação de dias que ainda não
  // aconteceram, e o placar ficaria parado esperando o calendário.
  const ate = hoje < challenge.endDate ? hoje : challenge.endDate;

  const bruto = membros
    .filter((m) => m.status === "aceito")
    .map((m) => {
      const student = db.students.find((s) => s.id === m.studentId);
      const user = student ? db.users.find((u) => u.id === student.userId) : undefined;
      return {
        studentId: m.studentId,
        nome: user?.name ?? "Aluno",
        avatarColor: user?.avatarColor ?? "#9aa1ac",
        ...placarDe(db, challenge, m.studentId, ate),
      };
    })
    .sort((a, b) => b.pontos - a.pontos || b.total - a.total || a.nome.localeCompare(b.nome));

  /* Empate divide a posição: dois com 12 pontos são ambos 1º e o próximo é 3º.
     Numerar 1, 2, 3 num empate inventaria uma vantagem que não existe. */
  const ranking: Colocacao[] = bruto.map((c, i) => ({ ...c, posicao: i + 1 }));
  for (let i = 1; i < ranking.length; i++) {
    const a = ranking[i - 1];
    const b = ranking[i];
    if (a.pontos === b.pontos && a.total === b.total) b.posicao = a.posicao;
  }

  return {
    challenge,
    membros,
    ranking,
    diasRestantes: diasEntre(hoje, challenge.endDate),
    encerrado: hoje > challenge.endDate || challenge.status === "cancelado",
    futuro: hoje < challenge.startDate,
  };
}

export function desafiosDoAluno(db: DbParaPlacar, studentId: string) {
  const meus = db.challengeMembers.filter((m) => m.studentId === studentId);
  const views = meus
    .map((m) => ({ membro: m, view: montarDesafio(db, m.challengeId) }))
    .filter((x): x is { membro: ChallengeMember; view: DesafioView } => x.view !== null)
    .filter((x) => x.view.challenge.status !== "cancelado");

  return {
    convites: views.filter((x) => x.membro.status === "convidado"),
    ativos: views
      .filter((x) => x.membro.status === "aceito" && !x.view.encerrado)
      .sort((a, b) => a.view.challenge.endDate.localeCompare(b.view.challenge.endDate)),
    encerrados: views
      .filter((x) => x.membro.status === "aceito" && x.view.encerrado)
      .sort((a, b) => b.view.challenge.endDate.localeCompare(a.view.challenge.endDate)),
  };
}
