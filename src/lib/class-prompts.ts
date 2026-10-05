import { notifyOnce } from "./repo-write";
import { loadProfessionalData, listProfessionals } from "./repo";
import { formatShortDate } from "./dates";
import { formatTime, pendingConfirmations, type PendingClass } from "./classes";
import type { Database } from "./types";

/* A pergunta "houve a aula?" que chega ao personal depois do horário.
 *
 * Não existe processo rodando o tempo todo: a pendência é CALCULADA a partir
 * da grade de horários toda vez que alguém pergunta, e só a notificação é
 * gravada. Duas consequências boas: a lista nunca fica dessincronizada do que
 * está na agenda, e mudar o horário de um aluno não deixa cobrança órfã.
 *
 * A gravação passa por notifyOnce, com o link servindo de chave: a mesma aula
 * não vira duas notificações, mesmo que o personal abra o app dez vezes e o
 * cron rode no meio.
 */

/** Link que identifica a aula — e, por ser único, impede a notificação dupla. */
export function promptLink(p: { studentId: string; date: string }): string {
  return `/app/agenda?dia=${p.date}&confirmar=${p.studentId}`;
}

function texto(p: PendingClass) {
  const hora = formatTime(p.startTime);
  return {
    title: `Houve a aula de ${p.studentName.split(" ")[0]}?`,
    body: `${formatShortDate(p.date)}${hora ? ` às ${hora}` : ""} — confirme para contar a aula no pacote.`,
  };
}

/** Cria as notificações que faltam para um personal. Devolve quantas criou. */
export async function syncClassPrompts(db: Database, personalUserId: string): Promise<number> {
  const pendentes = pendingConfirmations(db);
  let criadas = 0;

  for (const p of pendentes) {
    const { title, body } = texto(p);
    if (await notifyOnce(personalUserId, title, body, promptLink(p))) criadas++;
  }

  return criadas;
}

/** Mesma varredura, para todos os profissionais — é o que o cron chama.
 *  Sem sessão nenhuma: carrega os dados de cada profissional pelo id. */
export async function syncAllClassPrompts(): Promise<{ profissionais: number; criadas: number }> {
  const profissionais = await listProfessionals();
  let criadas = 0;

  for (const pro of profissionais) {
    const db = await loadProfessionalData(pro.id);
    criadas += await syncClassPrompts(db, pro.id);
  }

  return { profissionais: profissionais.length, criadas };
}
