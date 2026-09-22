export interface AnamnesisField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  required?: boolean;
}

export interface AnamnesisStep {
  key: string;
  title: string;
  description: string;
  fields: AnamnesisField[];
}

/** Anamnese em etapas: 50 perguntas numa tela única derrubam a taxa de resposta. */
export const ANAMNESIS_STEPS: AnamnesisStep[] = [
  {
    key: "objetivo",
    title: "Objetivo",
    description: "O que você quer alcançar e em quanto tempo.",
    fields: [
      {
        key: "objetivo_principal", label: "Objetivo principal", type: "select", required: true,
        options: ["Hipertrofia", "Emagrecimento", "Força", "Condicionamento", "Saúde e qualidade de vida", "Reabilitação / retorno"],
      },
      { key: "prazo", label: "Prazo desejado", type: "select", options: ["3 meses", "6 meses", "1 ano", "Sem prazo definido"] },
      { key: "motivacao", label: "O que te motivou a começar agora?", type: "textarea" },
    ],
  },
  {
    key: "treinamento",
    title: "Histórico de treino",
    description: "Sua experiência e disponibilidade.",
    fields: [
      {
        key: "experiencia", label: "Experiência com treino", type: "select", required: true,
        options: ["Nunca treinei", "Menos de 1 ano de treino", "De 1 a 2 anos", "Treina há mais de 2 anos"],
      },
      { key: "frequencia_desejada", label: "Quantos dias por semana pode treinar?", type: "select", options: ["2x por semana", "3x por semana", "4x por semana", "5x por semana", "6x por semana"] },
      { key: "local_treino", label: "Onde vai treinar?", type: "text" },
      { key: "horario", label: "Melhor horário para treinar", type: "text" },
    ],
  },
  {
    key: "saude",
    title: "Saúde",
    description: "Informações essenciais para a segurança do seu treino.",
    fields: [
      /* Estes cinco são obrigatórios porque é com eles que se decide o que o
         aluno pode fazer sem se machucar. "Nenhuma" é resposta válida e
         suficiente — o que não serve é o campo em branco, que não diz se não
         há nada ou se a pergunta foi pulada. */
      { key: "lesoes", label: "Lesões atuais ou anteriores", type: "textarea", required: true },
      { key: "dores", label: "Sente alguma dor hoje?", type: "textarea", required: true },
      { key: "cirurgias", label: "Cirurgias", type: "textarea" },
      { key: "medicamentos", label: "Medicamentos de uso contínuo", type: "textarea", required: true },
      { key: "doencas", label: "Doenças diagnosticadas", type: "textarea", required: true },
      {
        key: "parq", label: "PAR-Q: algum médico já disse que você só deveria fazer atividade física sob supervisão?",
        type: "select", required: true,
        options: ["Todas as respostas NÃO", "Sim, há alguma restrição médica"],
      },
      { key: "atestado", label: "Possui atestado ou liberação médica?", type: "select", options: ["Sim", "Não", "Em andamento"] },
    ],
  },
  {
    key: "rotina",
    title: "Rotina e hábitos",
    description: "O contexto fora da academia explica boa parte do resultado.",
    fields: [
      { key: "rotina", label: "Como é sua rotina de trabalho?", type: "textarea" },
      { key: "sono", label: "Quantas horas dorme por noite?", type: "select", options: ["Menos de 5 horas", "5 a 6 horas, irregular", "6 a 7 horas", "7 a 8 horas", "Mais de 8 horas"] },
      { key: "estresse", label: "Nível de estresse", type: "select", options: ["Baixo", "Moderado", "Alto"] },
      { key: "alimentacao", label: "Como é sua alimentação hoje?", type: "textarea" },
      { key: "agua", label: "Consumo de água por dia", type: "text" },
      { key: "alcool", label: "Consumo de álcool", type: "select", options: ["Não consome", "Socialmente", "Semanalmente", "Diariamente"] },
      { key: "tabagismo", label: "Fumante?", type: "select", options: ["Não", "Sim", "Ex-fumante"] },
      { key: "acompanhamento_nutricional", label: "Faz acompanhamento com nutricionista?", type: "select", options: ["Não", "Sim"] },
    ],
  },
  {
    key: "esportivo",
    title: "Histórico esportivo",
    description: "Outras atividades que você pratica.",
    fields: [
      { key: "esportes", label: "Pratica algum esporte?", type: "textarea" },
      { key: "atividades_extras", label: "Outras atividades na semana (caminhada, dança, etc.)", type: "textarea" },
      { key: "observacoes", label: "Mais alguma coisa que eu deva saber?", type: "textarea" },
    ],
  },
];

export const ANAMNESIS_FIELDS = ANAMNESIS_STEPS.flatMap((s) => s.fields);

/* Obrigatoriedade num único lugar, para o formulário do aluno, o do personal e
 * a validação no servidor nunca discordarem sobre o que é exigido. */

export const CAMPOS_OBRIGATORIOS = ANAMNESIS_FIELDS.filter((f) => f.required).map((f) => f.key);

/** Chaves obrigatórias que vieram vazias. Lista vazia = pode salvar. */
export function faltandoObrigatorios(answers: Record<string, string>): string[] {
  return CAMPOS_OBRIGATORIOS.filter((k) => (answers[k] ?? "").trim() === "");
}

/** Rótulo curto para mostrar ao usuário qual campo ficou faltando. */
export function rotuloCurto(key: string): string {
  const f = ANAMNESIS_FIELDS.find((x) => x.key === key);
  if (!f) return key;
  // o PAR-Q tem rótulo longo demais para caber numa lista de pendências
  return f.label.length > 42 ? `${f.label.slice(0, 40).trimEnd()}...` : f.label;
}

/** Índice da etapa que contém a chave, para levar o aluno até ela. */
export function etapaDoCampo(key: string): number {
  return ANAMNESIS_STEPS.findIndex((s) => s.fields.some((f) => f.key === key));
}
