import { sql, sqlOne } from "./sql";
import type {
  Anamnesis, Assessment, Attendance, Challenge, ChallengeEntry, ChallengeMember,
  Checkin, Consent, Database, Exercise, HabitLog,
  HabitStatus, HabitTarget,
  Notification, ProgressPhoto, Student, SubscriptionPlan, TrainingPlan, User, Workout,
  WorkoutExercise, WorkoutSession, WorkoutSet,
} from "./types";

/* Tradução entre o banco (snake_case, tipos do Postgres) e o domínio
 * (camelCase, o mesmo formato que as telas já usam desde o começo).
 *
 * Manter o formato de domínio intacto foi decisão de projeto: a migração troca
 * de onde os dados vêm, não como as telas os leem. */

type R = Record<string, unknown>;

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null ? null : Number(v));
const num = (v: unknown) => Number(v ?? 0);
const b = (v: unknown) => v === true;

/* DATE volta como Date do driver, e os dois drivers ancoram em fusos
 * diferentes para o mesmo valor:
 *
 *   PGlite (desenvolvimento) -> 2026-09-22T00:00:00Z  (meia-noite UTC)
 *   pg     (produção)        -> 2026-09-22T03:00:00Z  (meia-noite local, -03)
 *
 * Ler sempre com getters locais acertava em produção e errava um dia para trás
 * em desenvolvimento no Brasil; ler sempre em UTC inverteria o erro para quem
 * está em fuso positivo. A âncora revela a origem: instante exatamente em
 * meia-noite UTC só acontece quando o driver ancorou em UTC, e aí os getters
 * corretos são os de UTC. Nos demais casos o valor é meia-noite local.
 */
function date(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const ancoradoEmUtc =
      v.getUTCHours() === 0 &&
      v.getUTCMinutes() === 0 &&
      v.getUTCSeconds() === 0 &&
      v.getUTCMilliseconds() === 0;
    const y = ancoradoEmUtc ? v.getUTCFullYear() : v.getFullYear();
    const m = String((ancoradoEmUtc ? v.getUTCMonth() : v.getMonth()) + 1).padStart(2, "0");
    const d = String(ancoradoEmUtc ? v.getUTCDate() : v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

function dateOrNull(v: unknown): string | null {
  const out = date(v);
  return out === "" ? null : out;
}

function stamp(v: unknown): string {
  if (v == null) return "";
  return v instanceof Date ? v.toISOString() : String(v);
}

function intArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(Number);
  // PGlite pode devolver "{1,3,5}"
  if (typeof v === "string" && v.startsWith("{")) {
    return v.slice(1, -1).split(",").filter(Boolean).map(Number);
  }
  return [];
}

function jsonOf<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

/* ------------------------------------------------------------- mapeadores */

const toUser = (r: R): User => ({
  id: s(r.id), email: s(r.email), passwordHash: s(r.password_hash), name: s(r.name),
  role: s(r.role) as User["role"], professionalId: r.professional_id ? s(r.professional_id) : null,
  avatarColor: s(r.avatar_color), createdAt: date(r.created_at),
  mustChangePassword: b(r.must_change_password), isAdmin: b(r.is_admin),
});

const toStudent = (r: R): Student => ({
  id: s(r.id), userId: s(r.user_id), professionalId: s(r.professional_id),
  birthDate: date(r.birth_date), phone: s(r.phone),
  modality: s(r.modality) as Student["modality"], goal: s(r.goal),
  status: s(r.status) as Student["status"], startDate: date(r.start_date),
  trainingDays: intArray(r.training_days), notes: s(r.notes),
  publicProfile: b(r.public_profile),
});

const toExercise = (r: R): Exercise => ({
  id: s(r.id), professionalId: r.professional_id ? s(r.professional_id) : null,
  name: s(r.name), muscleGroup: s(r.muscle_group), equipment: s(r.equipment),
  videoUrl: s(r.video_url), instructions: s(r.instructions),
  commonMistakes: s(r.common_mistakes), tips: s(r.tips),
});

const toPlan = (r: R): TrainingPlan => ({
  id: s(r.id), studentId: s(r.student_id), professionalId: s(r.professional_id),
  name: s(r.name), goal: s(r.goal), startDate: date(r.start_date),
  endDate: date(r.end_date), active: b(r.active),
});

const toWorkout = (r: R): Workout => ({
  id: s(r.id), planId: s(r.plan_id), label: s(r.label), name: s(r.name),
  weekdays: intArray(r.weekdays), orderIndex: num(r.order_index),
  estimatedMinutes: num(r.estimated_minutes),
});

const toWorkoutExercise = (r: R): WorkoutExercise => ({
  id: s(r.id), workoutId: s(r.workout_id), exerciseId: s(r.exercise_id),
  orderIndex: num(r.order_index), sets: num(r.sets), repsMin: num(r.reps_min),
  repsMax: num(r.reps_max), load: num(r.load), restSeconds: num(r.rest_seconds),
  rir: num(r.rir), cadence: s(r.cadence), method: s(r.method), notes: s(r.notes),
});

const toSession = (r: R): WorkoutSession => ({
  id: s(r.id), studentId: s(r.student_id), workoutId: s(r.workout_id),
  startedAt: stamp(r.started_at), finishedAt: r.finished_at ? stamp(r.finished_at) : null,
  rpe: n(r.rpe), notes: s(r.notes),
});

const toSet = (r: R): WorkoutSet => ({
  id: s(r.id), sessionId: s(r.session_id), workoutExerciseId: s(r.workout_exercise_id),
  setNumber: num(r.set_number), load: num(r.load), reps: num(r.reps),
  rpe: n(r.rpe), doneAt: stamp(r.done_at),
});

const toCheckin = (r: R): Checkin => ({
  id: s(r.id), studentId: s(r.student_id), professionalId: s(r.professional_id),
  weekStart: date(r.week_start), status: s(r.status) as Checkin["status"],
  answeredAt: dateOrNull(r.answered_at),
  answers: r.answers ? jsonOf(r.answers, null as Checkin["answers"]) : null,
  coachReply: s(r.coach_reply),
});

const toAssessment = (r: R): Assessment => ({
  id: s(r.id), studentId: s(r.student_id), professionalId: s(r.professional_id),
  date: date(r.date), weight: n(r.weight), height: n(r.height),
  bodyFat: n(r.body_fat), muscleMass: n(r.muscle_mass),
  measurements: jsonOf(r.measurements, {
    cintura: null, abdomen: null, quadril: null, bracoD: null, coxaD: null, peitoral: null,
  }),
  notes: s(r.notes),
});

const toPhoto = (r: R): ProgressPhoto => ({
  id: s(r.id), studentId: s(r.student_id), month: s(r.month),
  angle: s(r.angle) as ProgressPhoto["angle"], fileName: s(r.file_name),
  createdAt: stamp(r.created_at),
});

/* Aceita booleano e número. Base criada antes das metas guarda os hábitos como
   sim/não; ali o antigo `true` significa "cumpriu". Sem esta tolerância, um
   banco ainda não migrado devolveria NaN e a tela inteira ficaria neutra. */
const habitStatus = (v: unknown): HabitStatus => {
  if (v === true) return 1;
  if (v === false || v === null || v === undefined) return 0;
  const n = Number(v);
  return n === 1 || n === 2 ? n : 0;
};

const toHabit = (r: R): HabitLog => ({
  id: s(r.id), studentId: s(r.student_id), date: date(r.date),
  water: habitStatus(r.water), nutrition: habitStatus(r.nutrition),
  sleep: habitStatus(r.sleep), steps: habitStatus(r.steps),
  supplement: habitStatus(r.supplement), notes: s(r.notes),
});

const toHabitTarget = (r: R): HabitTarget => ({
  id: s(r.id), studentId: s(r.student_id), professionalId: s(r.professional_id),
  waterMl: Number(r.water_ml ?? 0), nutrition: s(r.nutrition),
  supplement: s(r.supplement), updatedAt: date(r.updated_at),
});

const toConsent = (r: R): Consent => ({
  id: s(r.id), studentId: s(r.student_id), kind: s(r.kind) as Consent["kind"],
  granted: b(r.granted), version: s(r.version), decidedAt: stamp(r.decided_at),
});

const toChallenge = (r: R): Challenge => ({
  id: s(r.id), professionalId: s(r.professional_id), createdBy: s(r.created_by),
  name: s(r.name), kind: s(r.kind) as Challenge["kind"],
  goal: s(r.goal) as Challenge["goal"],
  period: s(r.period) as Challenge["period"],
  target: num(r.target), requirePhoto: b(r.require_photo),
  startDate: date(r.start_date), endDate: date(r.end_date),
  status: s(r.status) as Challenge["status"], createdAt: date(r.created_at),
});

const toChallengeMember = (r: R): ChallengeMember => ({
  id: s(r.id), challengeId: s(r.challenge_id), studentId: s(r.student_id),
  status: s(r.status) as ChallengeMember["status"], respondedAt: dateOrNull(r.responded_at),
});

const toChallengeEntry = (r: R): ChallengeEntry => ({
  id: s(r.id), challengeId: s(r.challenge_id), studentId: s(r.student_id),
  date: date(r.date), value: num(r.value), photoFileName: s(r.photo_file_name),
  note: s(r.note), createdAt: stamp(r.created_at),
});

const toAttendance = (r: R): Attendance => ({
  id: s(r.id), studentId: s(r.student_id), professionalId: s(r.professional_id),
  date: date(r.date), present: b(r.present), notes: s(r.notes),
});

const toAnamnesis = (r: R): Anamnesis => ({
  id: s(r.id), studentId: s(r.student_id), professionalId: s(r.professional_id),
  answeredAt: dateOrNull(r.answered_at), answers: jsonOf(r.answers, {}),
});

const toNotification = (r: R): Notification => ({
  id: s(r.id), userId: s(r.user_id), title: s(r.title), body: s(r.body),
  link: s(r.link), read: b(r.read), createdAt: date(r.created_at),
});

/* ------------------------------------------------------ autenticação (avulsa) */

export async function findUserByEmail(email: string): Promise<User | null> {
  const r = await sqlOne("SELECT * FROM users WHERE lower(email) = lower($1)", [email.trim()]);
  return r ? toUser(r) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const r = await sqlOne("SELECT * FROM users WHERE id = $1", [id]);
  return r ? toUser(r) : null;
}

export async function findStudentByUserId(userId: string): Promise<Student | null> {
  const r = await sqlOne("SELECT * FROM students WHERE user_id = $1", [userId]);
  return r ? toStudent(r) : null;
}

export async function findStudentById(id: string): Promise<Student | null> {
  const r = await sqlOne("SELECT * FROM students WHERE id = $1", [id]);
  return r ? toStudent(r) : null;
}

/* ------------------------------------------------------------------ snapshot */

/**
 * Carrega tudo que pertence a um profissional, no formato de domínio.
 *
 * É um punhado de consultas fixo, independente da quantidade de alunos —
 * buscar aluno por aluno daria dezenas de idas ao banco por tela, e em
 * serverless cada ida custa latência de rede.
 *
 * O escopo é o próprio isolamento multi-tenant: um profissional nunca
 * carrega linha de outro.
 */
export async function loadProfessionalData(professionalId: string): Promise<Database> {
  const P = [professionalId];

  const [
    users, students, exercises, plans, workouts, workoutExercises,
    sessions, sets, checkins, assessments, photos, habits, habitTargets,
    consents, challenges, challengeMembers, challengeEntries,
    attendance, anamnesis, notifications,
  ] = await Promise.all([
    sql("SELECT * FROM users WHERE id = $1 OR professional_id = $1", P),
    sql("SELECT * FROM students WHERE professional_id = $1", P),
    sql("SELECT * FROM exercises WHERE professional_id IS NULL OR professional_id = $1", P),
    sql("SELECT * FROM training_plans WHERE professional_id = $1", P),
    sql(`SELECT w.* FROM workouts w
           JOIN training_plans p ON p.id = w.plan_id
          WHERE p.professional_id = $1`, P),
    sql(`SELECT we.* FROM workout_exercises we
           JOIN workouts w ON w.id = we.workout_id
           JOIN training_plans p ON p.id = w.plan_id
          WHERE p.professional_id = $1`, P),
    sql(`SELECT ws.* FROM workout_sessions ws
           JOIN students st ON st.id = ws.student_id
          WHERE st.professional_id = $1`, P),
    sql(`SELECT wset.* FROM workout_sets wset
           JOIN workout_sessions ws ON ws.id = wset.session_id
           JOIN students st ON st.id = ws.student_id
          WHERE st.professional_id = $1`, P),
    sql("SELECT * FROM checkins WHERE professional_id = $1", P),
    sql("SELECT * FROM assessments WHERE professional_id = $1", P),
    sql(`SELECT ph.* FROM progress_photos ph
           JOIN students st ON st.id = ph.student_id
          WHERE st.professional_id = $1`, P),
    sql(`SELECT h.* FROM habit_logs h
           JOIN students st ON st.id = h.student_id
          WHERE st.professional_id = $1`, P),
    sql(`SELECT t.* FROM habit_targets t
           JOIN students st ON st.id = t.student_id
          WHERE st.professional_id = $1`, P),
    sql(`SELECT cs.* FROM consents cs
           JOIN students st ON st.id = cs.student_id
          WHERE st.professional_id = $1`, P),
    sql("SELECT * FROM challenges WHERE professional_id = $1", P),
    sql(`SELECT cm.* FROM challenge_members cm
           JOIN challenges ch ON ch.id = cm.challenge_id
          WHERE ch.professional_id = $1`, P),
    sql(`SELECT ce.* FROM challenge_entries ce
           JOIN challenges ch ON ch.id = ce.challenge_id
          WHERE ch.professional_id = $1`, P),
    sql("SELECT * FROM attendance WHERE professional_id = $1", P),
    sql("SELECT * FROM anamnesis WHERE professional_id = $1", P),
    sql(`SELECT nt.* FROM notifications nt
           JOIN users u ON u.id = nt.user_id
          WHERE u.id = $1 OR u.professional_id = $1`, P),
  ]);

  return {
    version: 2,
    users: users.map(toUser),
    students: students.map(toStudent),
    exercises: exercises.map(toExercise),
    trainingPlans: plans.map(toPlan),
    workouts: workouts.map(toWorkout),
    workoutExercises: workoutExercises.map(toWorkoutExercise),
    workoutSessions: sessions.map(toSession),
    workoutSets: sets.map(toSet),
    checkins: checkins.map(toCheckin),
    assessments: assessments.map(toAssessment),
    progressPhotos: photos.map(toPhoto),
    habitLogs: habits.map(toHabit),
    habitTargets: habitTargets.map(toHabitTarget),
    consents: consents.map(toConsent),
    challenges: challenges.map(toChallenge),
    challengeMembers: challengeMembers.map(toChallengeMember),
    challengeEntries: challengeEntries.map(toChallengeEntry),
    subscriptionPlans: [], // vivem fora do escopo por profissional; use listSubscriptionPlans()
    attendance: attendance.map(toAttendance),
    anamnesis: anamnesis.map(toAnamnesis),
    notifications: notifications.map(toNotification),
  };
}

/** Dono de um aluno, para escopar o snapshot a partir da sessão do próprio aluno. */
export async function professionalOf(studentId: string): Promise<string | null> {
  const r = await sqlOne<{ professional_id: string }>(
    "SELECT professional_id FROM students WHERE id = $1", [studentId],
  );
  return r?.professional_id ?? null;
}

/* ----------------------------------------------- planos de assinatura */

const toPlan2 = (r: R): SubscriptionPlan => ({
  id: s(r.id), name: s(r.name), months: num(r.months),
  priceCents: num(r.price_cents), listPriceCents: num(r.list_price_cents),
  installments: num(r.installments), description: s(r.description),
  active: b(r.active), orderIndex: num(r.order_index),
});

/* Fora do getDb() de propósito: planos não pertencem a um profissional, são
   do aplicativo. Enfiá-los no snapshot por profissional daria a impressão
   errada de que cada personal tem os seus. */
export async function listSubscriptionPlans(incluirInativos = false): Promise<SubscriptionPlan[]> {
  const rows = await sql(
    incluirInativos
      ? "SELECT * FROM subscription_plans ORDER BY order_index, months"
      : "SELECT * FROM subscription_plans WHERE active ORDER BY order_index, months",
  );
  return rows.map(toPlan2);
}

/** Administradores, para a tela de sócios. */
export async function listAdmins(): Promise<User[]> {
  const rows = await sql("SELECT * FROM users WHERE is_admin ORDER BY name");
  return rows.map(toUser);
}
