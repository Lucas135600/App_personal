import crypto from "node:crypto";
import type {
  Anamnesis, Assessment, Attendance, Challenge, ChallengeEntry, ChallengeMember,
  Checkin, Consent, Database, Exercise, HabitLog,
  HabitStatus, HabitTarget,
  Modality, Notification, Student, TrainingPlan, User, Workout, WorkoutExercise,
  WorkoutSession, WorkoutSet,
} from "./types";
import { addDays, currentWeekStart, formatDate, todayISO } from "./dates";
import { seedProgressPhotos, type PhotoSeedInput } from "./seed-photos";

import { hashPassword as hash } from "./password";

/** Gerador determinístico: o seed precisa ser reproduzível entre reinstalações. */
function makeRandom(seedValue: number) {
  let s = seedValue;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rnd = makeRandom(20260918);
const between = (min: number, max: number) => min + rnd() * (max - min);
const round = (v: number, d = 1) => Number(v.toFixed(d));

let counter = 0;
const sid = (p: string) => `${p}_${(++counter).toString(36).padStart(4, "0")}`;

const PRO_ID = "pro_lucas";

const EXERCISE_LIBRARY: Array<Omit<Exercise, "id" | "professionalId" | "videoUrl">> = [
  { name: "Supino reto com barra", muscleGroup: "Peitoral", equipment: "Barra", instructions: "Deite no banco com os pés apoiados e escápulas retraídas. Desça a barra até a linha do mamilo controlando a fase excêntrica e empurre sem travar o cotovelo.", commonMistakes: "Abrir demais os cotovelos; tirar o quadril do banco.", tips: "Cadência 3-0-1. Mantenha o punho neutro sobre o antebraço." },
  { name: "Supino inclinado com halteres", muscleGroup: "Peitoral", equipment: "Halteres", instructions: "Banco a 30-45 graus. Desça os halteres até sentir alongamento do peitoral e suba convergindo levemente.", commonMistakes: "Inclinar o banco alto demais e transformar em exercício de ombro.", tips: "Pare a 2-3 repetições da falha nas primeiras semanas." },
  { name: "Crucifixo na polia", muscleGroup: "Peitoral", equipment: "Polia", instructions: "Cotovelos semiflexionados e fixos, aproxime as mãos na linha do esterno.", commonMistakes: "Transformar em extensão de tríceps.", tips: "Segure 1 segundo na contração." },
  { name: "Puxada frontal aberta", muscleGroup: "Costas", equipment: "Polia alta", instructions: "Pegada pouco mais aberta que os ombros, puxe a barra até a clavícula levando os cotovelos para baixo.", commonMistakes: "Jogar o tronco muito para trás.", tips: "Inicie o movimento deprimindo as escápulas." },
  { name: "Remada curvada com barra", muscleGroup: "Costas", equipment: "Barra", instructions: "Tronco a 45 graus, coluna neutra, puxe a barra em direção ao umbigo.", commonMistakes: "Perder a neutralidade lombar.", tips: "Se a lombar fadigar antes, troque pela remada cavalinho." },
  { name: "Remada unilateral com halter", muscleGroup: "Costas", equipment: "Halter", instructions: "Apoie joelho e mão no banco e puxe o halter rente ao tronco.", commonMistakes: "Rotacionar o tronco para ganhar amplitude.", tips: "Amplitude completa, alongue embaixo." },
  { name: "Agachamento livre", muscleGroup: "Pernas", equipment: "Barra", instructions: "Pés na largura dos ombros, desça até pelo menos a coxa paralela mantendo o tronco estável.", commonMistakes: "Joelho colapsando para dentro; subir com o quadril primeiro.", tips: "Respire e trave o core antes de descer." },
  { name: "Leg press 45", muscleGroup: "Pernas", equipment: "Máquina", instructions: "Pés na largura do quadril no meio da plataforma, desça até 90 graus sem tirar o quadril do apoio.", commonMistakes: "Descer além do controle e arredondar a lombar.", tips: "Não trave o joelho no topo." },
  { name: "Cadeira extensora", muscleGroup: "Pernas", equipment: "Máquina", instructions: "Estenda o joelho até a contração máxima e volte controlando.", commonMistakes: "Usar impulso do quadril.", tips: "Segure 1s no topo." },
  { name: "Mesa flexora", muscleGroup: "Pernas", equipment: "Máquina", instructions: "Flexione o joelho levando o calcanhar ao glúteo sem tirar o quadril do apoio.", commonMistakes: "Levantar o quadril no fim do movimento.", tips: "Excêntrica de 3 segundos." },
  { name: "Levantamento terra romeno", muscleGroup: "Pernas", equipment: "Barra", instructions: "Joelhos levemente flexionados, empurre o quadril para trás mantendo a barra rente às pernas.", commonMistakes: "Agachar em vez de fazer dobradiça de quadril.", tips: "Pare quando a lombar começar a ceder." },
  { name: "Elevação pélvica", muscleGroup: "Glúteos", equipment: "Barra", instructions: "Costas apoiadas no banco, suba o quadril até a extensão completa contraindo o glúteo.", commonMistakes: "Hiperestender a lombar no topo.", tips: "Queixo levemente para o peito." },
  { name: "Cadeira abdutora", muscleGroup: "Glúteos", equipment: "Máquina", instructions: "Afaste as pernas controlando a volta.", commonMistakes: "Usar o tronco para empurrar.", tips: "Incline levemente o tronco à frente para priorizar o glúteo médio." },
  { name: "Desenvolvimento com halteres", muscleGroup: "Ombros", equipment: "Halteres", instructions: "Sentado com apoio, empurre os halteres acima da cabeça sem travar o cotovelo.", commonMistakes: "Arquear a lombar.", tips: "Core ativo, costelas para baixo." },
  { name: "Elevação lateral", muscleGroup: "Ombros", equipment: "Halteres", instructions: "Eleve os braços até a linha dos ombros liderando com o cotovelo.", commonMistakes: "Usar impulso de tronco.", tips: "Carga leve com foco em tensão continua." },
  { name: "Crucifixo inverso na polia", muscleGroup: "Ombros", equipment: "Polia", instructions: "Abra os braços na linha dos ombros contraindo o deltoide posterior.", commonMistakes: "Puxar com o dorsal.", tips: "Pegada neutra e cotovelo alto." },
  { name: "Rosca direta com barra W", muscleGroup: "Bíceps", equipment: "Barra W", instructions: "Cotovelos junto ao tronco, flexione até a contração total.", commonMistakes: "Balançar o tronco.", tips: "Controle a descida em 2 segundos." },
  { name: "Rosca martelo", muscleGroup: "Bíceps", equipment: "Halteres", instructions: "Pegada neutra, flexione alternando ou simultâneo.", commonMistakes: "Rotacionar o punho.", tips: "Boa opção para braquial e antebraço." },
  { name: "Tríceps na polia com corda", muscleGroup: "Tríceps", equipment: "Polia", instructions: "Cotovelos fixos ao lado do corpo, estenda abrindo a corda no final.", commonMistakes: "Afastar o cotovelo do tronco.", tips: "Tronco levemente inclinado." },
  { name: "Tríceps testa", muscleGroup: "Tríceps", equipment: "Barra W", instructions: "Desça a barra até a testa mantendo o cotovelo apontado para o teto.", commonMistakes: "Abrir os cotovelos.", tips: "Se doer o cotovelo, troque pela versão na polia." },
  { name: "Abdominal na polia alta", muscleGroup: "Core", equipment: "Polia", instructions: "Ajoelhado, flexione a coluna aproximando as costelas da pelve.", commonMistakes: "Usar o quadril como dobradiça.", tips: "Expire durante a flexão." },
  { name: "Prancha isométrica", muscleGroup: "Core", equipment: "Peso corporal", instructions: "Antebraços e pés no chão, corpo alinhado e glúteo contraído.", commonMistakes: "Elevar ou deixar cair o quadril.", tips: "Comece com 3x30s." },
  { name: "Esteira - caminhada inclinada", muscleGroup: "Cardio", equipment: "Esteira", instructions: "Inclinação de 8 a 12%, velocidade confortável, sem segurar no apoio.", commonMistakes: "Apoiar o peso nas mãos.", tips: "Zona 2: da para conversar, mas com esforço." },
  { name: "Bike ergométrica", muscleGroup: "Cardio", equipment: "Bike", instructions: "Ajuste o banco na altura do quadril e mantenha cadência de 80 a 90 rpm.", commonMistakes: "Banco baixo demais sobrecarregando o joelho.", tips: "Boa opção em dias de dor articular." },
];

type TemplateItem = [string, number, number, number, number, number, string];

const WORKOUT_TEMPLATES: Array<{ label: string; name: string; items: TemplateItem[] }> = [
  {
    label: "A", name: "Peitoral + Tríceps",
    items: [
      ["Supino reto com barra", 4, 8, 12, 90, 2, "Controlar a fase excêntrica."],
      ["Supino inclinado com halteres", 3, 10, 12, 75, 2, ""],
      ["Crucifixo na polia", 3, 12, 15, 60, 1, "Segurar 1s na contração."],
      ["Tríceps na polia com corda", 4, 10, 15, 60, 1, ""],
      ["Tríceps testa", 3, 10, 12, 60, 2, ""],
      ["Prancha isométrica", 3, 30, 45, 45, 0, "Repetições em segundos."],
    ],
  },
  {
    label: "B", name: "Costas + Bíceps",
    items: [
      ["Puxada frontal aberta", 4, 8, 12, 90, 2, ""],
      ["Remada curvada com barra", 4, 8, 10, 90, 2, "Coluna neutra."],
      ["Remada unilateral com halter", 3, 10, 12, 60, 2, ""],
      ["Rosca direta com barra W", 3, 10, 12, 60, 1, ""],
      ["Rosca martelo", 3, 10, 15, 60, 1, ""],
      ["Abdominal na polia alta", 3, 12, 15, 45, 1, ""],
    ],
  },
  {
    label: "C", name: "Pernas completo",
    items: [
      ["Agachamento livre", 4, 6, 10, 120, 2, "Aquecer com 2 séries leves."],
      ["Leg press 45", 4, 10, 12, 90, 2, ""],
      ["Levantamento terra romeno", 3, 8, 12, 90, 2, ""],
      ["Cadeira extensora", 3, 12, 15, 60, 1, ""],
      ["Mesa flexora", 3, 12, 15, 60, 1, ""],
      ["Elevação pélvica", 3, 10, 12, 75, 2, ""],
    ],
  },
];

interface SeedStudent {
  name: string; email: string; birthDate: string; phone: string;
  modality: Modality; goal: string; color: string; height: number;
  adherence: number; checkinRate: number; startWeight: number; trend: number;
  trainingDays: number[]; lastAssessmentDaysAgo: number; notes: string;
}

const STUDENTS: SeedStudent[] = [
  { name: "João Mendes", email: "joao@aluno.com", birthDate: "1992-03-14", phone: "(65) 99811-2233", modality: "presencial", goal: "Hipertrofia", color: "#4ade80", height: 1.78, adherence: 0.94, checkinRate: 1, startWeight: 88.4, trend: -0.35, trainingDays: [1, 3, 5], lastAssessmentDaysAgo: 22, notes: "Boa técnica. Evoluir carga no agachamento." },
  { name: "Maria Lopes", email: "maria@aluno.com", birthDate: "1995-07-02", phone: "(65) 99744-8891", modality: "online", goal: "Emagrecimento", color: "#f472b6", height: 1.68, adherence: 0.86, checkinRate: 0.83, startWeight: 71.2, trend: -0.4, trainingDays: [1, 2, 4, 5], lastAssessmentDaysAgo: 40, notes: "Responde bem a cardio zona 2. Sono irregular." },
  { name: "Pedro Alves", email: "pedro@aluno.com", birthDate: "1988-11-27", phone: "(65) 99633-5510", modality: "online", goal: "Emagrecimento", color: "#fb923c", height: 1.8, adherence: 0.48, checkinRate: 0.4, startWeight: 102.5, trend: -0.12, trainingDays: [2, 4, 6], lastAssessmentDaysAgo: 96, notes: "Rotina de viagem. Precisa de treino curto alternativo." },
  { name: "Ana Beatriz", email: "ana@aluno.com", birthDate: "1999-01-19", phone: "(65) 99522-4477", modality: "presencial", goal: "Condicionamento", color: "#38bdf8", height: 1.64, adherence: 0.97, checkinRate: 1, startWeight: 58.9, trend: 0.1, trainingDays: [1, 2, 3, 4, 5], lastAssessmentDaysAgo: 12, notes: "Atleta amadora de corrida. Cuidado com volume de pernas." },
  { name: "Rafael Costa", email: "rafael@aluno.com", birthDate: "1990-05-08", phone: "(65) 99410-6632", modality: "hibrido", goal: "Força", color: "#a78bfa", height: 1.82, adherence: 0.79, checkinRate: 0.67, startWeight: 94, trend: 0.05, trainingDays: [1, 3, 5], lastAssessmentDaysAgo: 58, notes: "Foco em básicos. Dor lombar leve ao terra - monitorar." },
  { name: "Carla Souza", email: "carla@aluno.com", birthDate: "1983-09-30", phone: "(65) 99388-1120", modality: "online", goal: "Saúde e qualidade de vida", color: "#fbbf24", height: 1.6, adherence: 0.68, checkinRate: 0.5, startWeight: 66.3, trend: -0.18, trainingDays: [2, 4], lastAssessmentDaysAgo: 88, notes: "Retomando após pausa. Progressão conservadora." },
];

function anamnesisAnswers(s: SeedStudent) {
  return {
    objetivo_principal: s.goal,
    prazo: "6 meses",
    experiencia: s.adherence > 0.8 ? "Treina há mais de 2 anos" : "Menos de 1 ano de treino",
    frequencia_desejada: `${s.trainingDays.length}x por semana`,
    local_treino: s.modality === "online" ? "Academia perto de casa" : "Estúdio do personal",
    lesoes: s.name === "Rafael Costa" ? "Desconforto lombar ao levantar peso do chão" : "Nenhuma relatada",
    dores: s.name === "Rafael Costa" ? "Lombar após levantamento terra" : "Não",
    cirurgias: "Não",
    medicamentos: "Não faz uso contínuo",
    doencas: "Nega hipertensão, diabetes e cardiopatias",
    parq: "Todas as respostas NÃO",
    sono: s.name === "Maria Lopes" ? "5 a 6 horas, irregular" : "7 a 8 horas",
    alimentacao: "3 refeições principais e 1 lanche",
    agua: "Cerca de 2 litros por dia",
    alcool: "Socialmente",
    tabagismo: "Não",
    rotina: "Trabalho em horário comercial",
    esportes: s.name === "Ana Beatriz" ? "Corrida de rua, 10km" : "Nenhum no momento",
    observacoes: s.notes,
  };
}

export function buildSeed(): Database {
  const today = todayISO();
  const users: User[] = [];
  const students: Student[] = [];
  const exercises: Exercise[] = [];
  const trainingPlans: TrainingPlan[] = [];
  const workouts: Workout[] = [];
  const workoutExercises: WorkoutExercise[] = [];
  const workoutSessions: WorkoutSession[] = [];
  const workoutSets: WorkoutSet[] = [];
  const checkins: Checkin[] = [];
  const assessments: Assessment[] = [];
  const habitLogs: HabitLog[] = [];
  const habitTargets: HabitTarget[] = [];
  const consents: Consent[] = [];
  const challenges: Challenge[] = [];
  const challengeMembers: ChallengeMember[] = [];
  const challengeEntries: ChallengeEntry[] = [];
  const attendance: Attendance[] = [];
  const anamnesis: Anamnesis[] = [];
  const notifications: Notification[] = [];
  const photoInputs: PhotoSeedInput[] = [];

  users.push({
    id: PRO_ID,
    email: "lucas@lbpersonal.com",
    passwordHash: hash("lb123456"),
    name: "Lucas Braz",
    role: "personal",
    professionalId: null,
    avatarColor: "#c8f542",
    createdAt: addDays(today, -400),
  });

  for (const e of EXERCISE_LIBRARY) {
    exercises.push({ id: sid("ex"), professionalId: null, videoUrl: "", ...e });
  }
  const exByName = new Map(exercises.map((e) => [e.name, e.id]));

  for (const s of STUDENTS) {
    const userId = sid("usr");
    const studentId = sid("std");

    users.push({
      id: userId, email: s.email, passwordHash: hash("aluno123"), name: s.name,
      role: "student", professionalId: PRO_ID, avatarColor: s.color,
      createdAt: addDays(today, -180),
    });
    students.push({
      id: studentId, userId, professionalId: PRO_ID, birthDate: s.birthDate,
      phone: s.phone, modality: s.modality, goal: s.goal, status: "ativo",
      startDate: addDays(today, -180), trainingDays: s.trainingDays, notes: s.notes,
      publicProfile: true,
    });
    anamnesis.push({
      id: sid("anm"), studentId, professionalId: PRO_ID,
      answeredAt: addDays(today, -178), answers: anamnesisAnswers(s),
    });

    const planId = sid("plan");
    trainingPlans.push({
      id: planId, studentId, professionalId: PRO_ID,
      name: `Bloco ${s.goal} - fase 2`, goal: s.goal,
      startDate: addDays(today, -56), endDate: addDays(today, 28), active: true,
    });

    const planWorkouts: Workout[] = [];
    WORKOUT_TEMPLATES.forEach((tpl, i) => {
      const workoutId = sid("wk");
      const w: Workout = {
        id: workoutId, planId, label: tpl.label, name: tpl.name,
        weekdays: [s.trainingDays[i % s.trainingDays.length]],
        orderIndex: i, estimatedMinutes: 50 + i * 5,
      };
      workouts.push(w);
      planWorkouts.push(w);
      tpl.items.forEach(([name, sets, repsMin, repsMax, rest, rir, notes], j) => {
        workoutExercises.push({
          id: sid("we"), workoutId, exerciseId: exByName.get(name)!, orderIndex: j,
          sets, repsMin, repsMax,
          load: Math.round(between(15, 90) / 2.5) * 2.5,
          restSeconds: rest, rir, cadence: "3-0-1", method: "", notes,
        });
      });
    });

    // Sessões dos últimos 56 dias, respeitando a aderência do aluno.
    let wIdx = 0;
    for (let d = 56; d >= 0; d--) {
      const date = addDays(today, -d);
      const dow = new Date(`${date}T12:00:00`).getDay();
      if (!s.trainingDays.includes(dow)) continue;

      const trained = rnd() < s.adherence && !(s.name === "Pedro Alves" && d < 7);
      if (s.modality !== "online") {
        attendance.push({
          id: sid("att"), studentId, professionalId: PRO_ID, date,
          present: trained, notes: "",
        });
      }
      if (!trained) continue;

      const workout = planWorkouts[wIdx % planWorkouts.length];
      wIdx++;
      const sessionId = sid("ses");
      workoutSessions.push({
        id: sessionId, studentId, workoutId: workout.id,
        startedAt: `${date}T07:${String(Math.floor(between(0, 50))).padStart(2, "0")}:00`,
        finishedAt: `${date}T08:${String(Math.floor(between(0, 50))).padStart(2, "0")}:00`,
        rpe: Math.round(between(5, 9)), notes: "",
      });

      const items = workoutExercises.filter((we) => we.workoutId === workout.id);
      for (const we of items) {
        const progress = 1 + (56 - d) * 0.0012;
        for (let setN = 1; setN <= we.sets; setN++) {
          workoutSets.push({
            id: sid("set"), sessionId, workoutExerciseId: we.id, setNumber: setN,
            load: Math.round((we.load * progress) / 2.5) * 2.5,
            reps: Math.round(between(we.repsMin, we.repsMax)),
            rpe: Math.round(between(6, 9)),
            doneAt: `${date}T07:${String(20 + setN).padStart(2, "0")}:00`,
          });
        }
      }
    }

    // Check-ins das últimas 7 semanas (a semana atual começa pendente).
    const thisWeek = currentWeekStart();
    for (let w = 6; w >= 0; w--) {
      const ws = addDays(thisWeek, -7 * w);
      const isCurrent = w === 0;
      const answered = isCurrent ? rnd() < s.checkinRate * 0.5 : rnd() < s.checkinRate;
      checkins.push(
        answered
          ? {
              id: sid("chk"), studentId, professionalId: PRO_ID, weekStart: ws,
              status: "respondido", answeredAt: addDays(ws, 6),
              answers: {
                week: 7 - w,
                workoutsDone: Math.round(s.trainingDays.length * s.adherence),
                energy: Math.round(between(3, 5)),
                sleep: Math.round(between(2, 5)),
                nutrition: Math.round(between(2, 5)),
                motivation: Math.round(between(3, 5)),
                pain: rnd() < 0.15,
                painNotes: "",
                weight: round(s.startWeight + s.trend * (6 - w) + between(-0.3, 0.3)),
                notes: "",
              },
              coachReply: "",
            }
          : {
              id: sid("chk"), studentId, professionalId: PRO_ID, weekStart: ws,
              status: isCurrent ? "pendente" : "atrasado",
              answeredAt: null, answers: null, coachReply: "",
            },
      );
    }

    // Avaliações físicas ao longo dos últimos 6 meses.
    const offsets = Array.from(new Set([180, 120, 60, s.lastAssessmentDaysAgo]))
      .filter((v) => v <= 180)
      .sort((a, b) => b - a);
    offsets.forEach((offset, i) => {
      const elapsedWeeks = (180 - offset) / 7;
      assessments.push({
        id: sid("asm"), studentId, professionalId: PRO_ID, date: addDays(today, -offset),
        weight: round(s.startWeight + s.trend * elapsedWeeks),
        height: s.height,
        bodyFat: round(Math.max(8, 26 - i * 1.4 + between(-1, 1))),
        muscleMass: round(32 + i * 0.5 + between(-1, 1)),
        measurements: {
          cintura: round(92 - i * 1.5 + between(-1, 1)),
          abdomen: round(96 - i * 1.6 + between(-1, 1)),
          quadril: round(101 - i * 0.9 + between(-1, 1)),
          bracoD: round(35 + i * 0.6 + between(-0.4, 0.4)),
          coxaD: round(56 + i * 0.5 + between(-0.5, 0.5)),
          peitoral: round(99 + i * 0.4 + between(-0.6, 0.6)),
        },
        notes: i === offsets.length - 1 ? "Manter déficit leve e força nos básicos." : "",
      });
    });

    // Três estados: cumpriu (1), não cumpriu (2) e sem resposta (0). Uma fatia
    // fica sem resposta de propósito — é o caso real de quem esquece de marcar,
    // e é o que deixa a tela de consistência honesta na demonstração.
    const estado = (p: number): HabitStatus => (rnd() < 0.12 ? 0 : rnd() < p ? 1 : 2);
    for (let d = 20; d >= 0; d--) {
      habitLogs.push({
        id: sid("hab"), studentId, date: addDays(today, -d),
        water: estado(0.8), nutrition: estado(s.adherence),
        sleep: estado(0.7), steps: estado(0.65),
        supplement: estado(0.5), notes: "",
      });
    }

    /* Aluno de demonstração já aceitou, senão a primeira tela seria sempre a
       de consentimento. Um deles recusa a imagem, para a versão sem foto
       aparecer na demonstração em vez de só existir no código. */
    const aceitouImagem = STUDENTS.indexOf(s) !== 1;
    consents.push({
      id: sid("cns"), studentId, kind: "dados", granted: true,
      version: "2026-09-v1", decidedAt: `${addDays(today, -60)}T12:00:00.000Z`,
    });
    consents.push({
      id: sid("cns"), studentId, kind: "imagem", granted: aceitouImagem,
      version: "2026-09-v1", decidedAt: `${addDays(today, -60)}T12:00:00.000Z`,
    });

    // Metas de exemplo, para a tela do aluno nascer com algo para cumprir.
    habitTargets.push({
      id: sid("hbt"), studentId, professionalId: PRO_ID,
      waterMl: 3000,
      nutrition: "4 refeições, proteína em todas. Evitar ultraprocessados durante a semana.",
      supplement: "Whey pós-treino e creatina 5 g por dia, no horário que preferir.",
      updatedAt: addDays(today, -7),
    });

    // Alunos consistentes já registraram a foto do mês corrente; os demais não,
    // para o alerta de "foto mensal pendente" continuar visível na demonstração.
    photoInputs.push({
      studentId,
      monthsBack: s.adherence >= 0.75 ? [3, 2, 1, 0] : [3, 2],
      build: STUDENTS.indexOf(s) / (STUDENTS.length - 1),
    });

    notifications.push({
      id: sid("ntf"), userId, title: "Seu treino da semana está disponível",
      body: "O Lucas atualizou seu bloco de treino. Confira os ajustes de carga.",
      link: "/aluno/treinos", read: false, createdAt: addDays(today, -2),
    });
  }

  const recentCutoff = addDays(currentWeekStart(), -7);
  for (const c of checkins) {
    if (c.status === "respondido" || c.weekStart < recentCutoff) continue;
    const st = students.find((s) => s.id === c.studentId)!;
    const u = users.find((x) => x.id === st.userId)!;
    notifications.push({
      id: sid("ntf"), userId: PRO_ID, title: `Check-in pendente - ${u.name}`,
      body: `A semana iniciada em ${formatDate(c.weekStart)} ainda está sem resposta.`,
      link: `/app/alunos/${st.id}?tab=checkins`, read: false,
      createdAt: addDays(today, -1),
    });
  }

  /* Dois desafios de demonstração: um duelo em andamento e um grupo com
     convite pendente, para a tela nascer mostrando os dois estados. */
  if (students.length >= 4) {
    const duelo = sid("chl");
    challenges.push({
      id: duelo, professionalId: PRO_ID, createdBy: students[0].id,
      name: "Quem treina mais em outubro",
      kind: "duelo", goal: "cardio_min", period: "diario", target: 30, requirePhoto: true,
      startDate: addDays(today, -10), endDate: addDays(today, 18),
      status: "ativo", createdAt: addDays(today, -10),
    });
    for (const st of [students[0], students[1]]) {
      challengeMembers.push({
        id: sid("clm"), challengeId: duelo, studentId: st.id,
        status: "aceito", respondedAt: addDays(today, -10),
      });
    }

    const grupo = sid("chl");
    challenges.push({
      id: grupo, professionalId: PRO_ID, createdBy: students[2].id,
      name: "Semana dos hábitos",
      kind: "grupo", goal: "habitos", period: "total", target: 0, requirePhoto: false,
      startDate: addDays(today, -4), endDate: addDays(today, 3),
      status: "ativo", createdAt: addDays(today, -4),
    });
    challengeMembers.push({
      id: sid("clm"), challengeId: grupo, studentId: students[2].id,
      status: "aceito", respondedAt: addDays(today, -4),
    });
    challengeMembers.push({
      id: sid("clm"), challengeId: grupo, studentId: students[3].id,
      status: "aceito", respondedAt: addDays(today, -3),
    });
    // O primeiro aluno fica com convite em aberto: é o estado que a tela
    // precisa mostrar e que só aparece se alguém estiver nele.
    challengeMembers.push({
      id: sid("clm"), challengeId: grupo, studentId: students[0].id,
      status: "convidado", respondedAt: null,
    });
  }

  return {
    version: 1, users, students, exercises, trainingPlans, workouts,
    workoutExercises, workoutSessions, workoutSets, checkins, assessments,
    progressPhotos: seedProgressPhotos(photoInputs),
    habitTargets,
    consents,
    challenges,
    challengeMembers,
    challengeEntries,
    habitLogs, attendance, anamnesis, notifications,
  };
}
