/** Modelo de dados do MVP. Toda entidade ligada ao aluno carrega professionalId
 *  desde o início para que a plataforma possa virar multi-tenant sem migração. */

export type Role = "personal" | "student";
export type Modality = "presencial" | "online" | "hibrido";
export type StudentStatus = "ativo" | "inativo";
export type CheckinStatus = "pendente" | "respondido" | "atrasado";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  professionalId: string | null;
  avatarColor: string;
  createdAt: string;
  /** Senha de primeiro acesso ainda não trocada. */
  mustChangePassword: boolean;
}

export interface Student {
  id: string;
  userId: string;
  professionalId: string;
  birthDate: string;
  phone: string;
  modality: Modality;
  goal: string;
  status: StudentStatus;
  startDate: string;
  trainingDays: number[];
  notes: string;
  /** Visível para os outros alunos do mesmo personal. Desligado por padrão. */
  publicProfile: boolean;
}

export interface Exercise {
  id: string;
  professionalId: string | null;
  name: string;
  muscleGroup: string;
  equipment: string;
  videoUrl: string;
  instructions: string;
  commonMistakes: string;
  tips: string;
}

export interface TrainingPlan {
  id: string;
  studentId: string;
  professionalId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface Workout {
  id: string;
  planId: string;
  label: string;
  name: string;
  weekdays: number[];
  orderIndex: number;
  estimatedMinutes: number;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  load: number;
  restSeconds: number;
  rir: number;
  cadence: string;
  method: string;
  notes: string;
}

export interface WorkoutSession {
  id: string;
  studentId: string;
  workoutId: string;
  startedAt: string;
  finishedAt: string | null;
  rpe: number | null;
  notes: string;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  workoutExerciseId: string;
  setNumber: number;
  load: number;
  reps: number;
  rpe: number | null;
  doneAt: string;
}

export interface CheckinAnswers {
  week: number;
  workoutsDone: number;
  energy: number;
  sleep: number;
  nutrition: number;
  motivation: number;
  pain: boolean;
  painNotes: string;
  weight: number | null;
  notes: string;
}

export interface Checkin {
  id: string;
  studentId: string;
  professionalId: string;
  weekStart: string;
  status: CheckinStatus;
  answeredAt: string | null;
  answers: CheckinAnswers | null;
  coachReply: string;
}

export interface Measurements {
  cintura: number | null;
  abdomen: number | null;
  quadril: number | null;
  bracoD: number | null;
  coxaD: number | null;
  peitoral: number | null;
}

export interface Assessment {
  id: string;
  studentId: string;
  professionalId: string;
  date: string;
  weight: number | null;
  height: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  measurements: Measurements;
  notes: string;
}

export type PhotoAngle = "frente" | "lateral" | "costas";

export interface ProgressPhoto {
  id: string;
  studentId: string;
  month: string;
  angle: PhotoAngle;
  fileName: string;
  createdAt: string;
}

/** 0 = sem resposta, 1 = cumpriu a meta, 2 = não cumpriu.
 *  "Sem resposta" e "não cumpriu" são coisas diferentes e precisam continuar
 *  diferentes: misturar as duas faz o dia que ainda nem chegou contar contra
 *  o aluno. */
export type HabitStatus = 0 | 1 | 2;

export interface HabitLog {
  id: string;
  studentId: string;
  date: string;
  water: HabitStatus;
  nutrition: HabitStatus;
  sleep: HabitStatus;
  steps: HabitStatus;
  supplement: HabitStatus;
  notes: string;
}

/** Metas que o personal define para o aluno. Uma por aluno. */
export interface HabitTarget {
  id: string;
  studentId: string;
  professionalId: string;
  /** Em mililitros; a tela mostra em litros. 0 = sem meta definida. */
  waterMl: number;
  nutrition: string;
  supplement: string;
  updatedAt: string;
}

/** Duelo é 1x1; grupo aceita quantos o criador convidar. */
export type ChallengeKind = "duelo" | "grupo";

/** O que conta ponto.
 *  `treinos` e `habitos` o app mede sozinho; os outros três o aluno registra. */
export type ChallengeGoal =
  | "treinos"
  | "habitos"
  | "cardio_min"
  | "abdominais"
  | "corrida_km";

/** `diario`/`semanal` contam períodos em que a meta foi batida; `total` soma. */
export type ChallengePeriod = "diario" | "semanal" | "total";
export type ChallengeMemberStatus = "convidado" | "aceito" | "recusado" | "saiu";

export interface Challenge {
  id: string;
  professionalId: string;
  createdBy: string;
  name: string;
  kind: ChallengeKind;
  goal: ChallengeGoal;
  period: ChallengePeriod;
  /** Meta por período. 0 quando o desafio é só somar. */
  target: number;
  requirePhoto: boolean;
  startDate: string;
  endDate: string;
  status: "ativo" | "cancelado";
  createdAt: string;
}

export interface ChallengeMember {
  id: string;
  challengeId: string;
  studentId: string;
  status: ChallengeMemberStatus;
  respondedAt: string | null;
}

/** Registro manual do aluno num dia. Um por dia: regravar corrige. */
export interface ChallengeEntry {
  id: string;
  challengeId: string;
  studentId: string;
  date: string;
  value: number;
  photoFileName: string;
  note: string;
  createdAt: string;
}

/** 'dados' = tratar dado de saúde; 'imagem' = usar fotos para avaliação. */
export type ConsentKind = "dados" | "imagem";

/** Uma decisão de consentimento. O histórico inteiro fica guardado: é ele que
 *  prova o que foi aceito, quando, e com qual texto. */
export interface Consent {
  id: string;
  studentId: string;
  kind: ConsentKind;
  granted: boolean;
  version: string;
  decidedAt: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  professionalId: string;
  date: string;
  present: boolean;
  notes: string;
}

export interface AnamnesisAnswers {
  [key: string]: string;
}

export interface Anamnesis {
  id: string;
  studentId: string;
  professionalId: string;
  answeredAt: string | null;
  answers: AnamnesisAnswers;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Database {
  version: number;
  users: User[];
  students: Student[];
  exercises: Exercise[];
  trainingPlans: TrainingPlan[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSessions: WorkoutSession[];
  workoutSets: WorkoutSet[];
  checkins: Checkin[];
  assessments: Assessment[];
  progressPhotos: ProgressPhoto[];
  habitLogs: HabitLog[];
  habitTargets: HabitTarget[];
  consents: Consent[];
  challenges: Challenge[];
  challengeMembers: ChallengeMember[];
  challengeEntries: ChallengeEntry[];
  attendance: Attendance[];
  anamnesis: Anamnesis[];
  notifications: Notification[];
}
