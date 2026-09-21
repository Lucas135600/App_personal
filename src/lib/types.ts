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

export interface HabitLog {
  id: string;
  studentId: string;
  date: string;
  water: boolean;
  nutrition: boolean;
  sleep: boolean;
  steps: boolean;
  supplement: boolean;
  notes: string;
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
  attendance: Attendance[];
  anamnesis: Anamnesis[];
  notifications: Notification[];
}
