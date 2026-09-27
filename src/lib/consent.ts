import type { Consent, ConsentKind, Database } from "./types";

/* Consentimento da LGPD num lugar só: o texto, a versão e a leitura do estado.
 *
 * A versão é gravada junto com cada decisão. Se um dia o texto mudar, o
 * consentimento antigo continua provando exatamente o que a pessoa leu naquele
 * dia — e dá para saber quem precisa aceitar de novo. Por isso o texto vive
 * aqui, e não espalhado pela tela: mudar a redação sem trocar a versão
 * invalidaria silenciosamente a prova.
 */

/** Mude junto com o texto. Formato: ano-mês-sequência.
 *  v2: passou a dizer que foto de desafio é vista pelos adversários. A v1 não
 *  cobria isso, e o app passou a fazer — o texto tinha que acompanhar. */
export const VERSAO_TERMO = "2026-09-v2";

export const TERMO_DADOS = {
  titulo: "Tratamento dos meus dados de saúde",
  resumo:
    "Autorizo a Vision Fitness a coletar e guardar meus dados de saúde e de treino " +
    "para montar e acompanhar meu programa.",
  itens: [
    "Quais dados: anamnese (lesões, dores, doenças, medicamentos), medidas corporais, peso, treinos realizados, check-ins e hábitos.",
    "Para quê: montar seu treino com segurança e acompanhar sua evolução. Nada além disso.",
    "Quem acessa: apenas você e seu personal trainer. Nenhum dado é vendido, compartilhado ou usado para publicidade.",
    "Por quanto tempo: enquanto você for aluno, e por mais 5 anos depois — prazo que a legislação profissional exige para registros de atendimento.",
    "Você pode, a qualquer momento, pedir para ver, corrigir ou apagar seus dados. Basta falar com seu personal.",
  ],
} as const;

export const TERMO_IMAGEM = {
  titulo: "Uso das minhas fotos para avaliação",
  resumo:
    "Autorizo o envio de fotos do meu corpo e a comparação entre elas para avaliar " +
    "minha evolução física.",
  itens: [
    "Fotos de evolução: ficam em área privada e só abrem para você e seu personal, com sessão aberta. Não têm link público.",
    "Servem apenas para comparar sua evolução. Não são usadas em divulgação, redes sociais ou material de propaganda.",
    "Para usar sua imagem em qualquer divulgação, seu personal precisa pedir uma autorização separada e específica.",
    /* Este item existe porque o app passou a ter desafios com comprovação, e o
       texto anterior prometia que foto nenhuma saía de você e do personal.
       Dizer uma coisa e fazer outra é o que invalida um consentimento. */
    "Fotos de desafio são diferentes: quando você entra num desafio que pede comprovação, a foto que enviar aparece para os outros participantes daquele desafio. Só para eles, e só enquanto você participar. Entrar nesses desafios é escolha sua, desafio por desafio.",
    "Esta autorização é opcional: sem ela o aplicativo funciona normalmente, só não envia fotos.",
  ],
} as const;

/** Estado vigente de cada consentimento: a decisão mais recente vale. */
export function estadoConsentimento(
  db: Pick<Database, "consents">,
  studentId: string,
): { dados: boolean; imagem: boolean; em: Record<ConsentKind, string | null> } {
  const ultimo = (kind: ConsentKind): Consent | undefined =>
    db.consents
      .filter((c) => c.studentId === studentId && c.kind === kind)
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];

  const dados = ultimo("dados");
  const imagem = ultimo("imagem");

  return {
    dados: dados?.granted ?? false,
    imagem: imagem?.granted ?? false,
    em: {
      dados: dados?.decidedAt ?? null,
      imagem: imagem?.decidedAt ?? null,
    },
  };
}
