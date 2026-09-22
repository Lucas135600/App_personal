import { sql, sqlOne, transaction } from "./sql";
import { id } from "./db";
import { currentWeekStart, todayISO } from "./dates";
import type {
  CheckinAnswers, Measurements, Modality, PhotoAngle, StudentStatus,
} from "./types";

/* Escritas. Cada função é uma operação de negócio inteira — quando ela toca
 * mais de uma tabela, vai numa transação, para não deixar meio estado gravado.
 *
 * Diferença que importa em relação ao arquivo JSON anterior: ali toda escrita
 * regravava o arquivo inteiro, e dois alunos salvando ao mesmo tempo perdiam
 * uma das gravações. Aqui cada comando altera só as linhas que interessam. */

/* ------------------------------------------------------------------ alunos */

export interface NovoAluno {
  name: string;
  email: string;
  passwordHash: string;
  avatarColor: string;
  birthDate: string;
  phone: string;
  modality: Modality;
  goal: string;
  trainingDays: number[];
  notes: string;
  planEnd: string;
}

export async function insertStudent(professionalId: string, a: NovoAluno): Promise<string> {
  const userId = id("usr");
  const studentId = id("std");
  const hoje = todayISO();

  await transaction(async (q) => {
    await q(
      `INSERT INTO users (id, email, password_hash, name, role, professional_id, avatar_color, created_at)
       VALUES ($1, $2, $3, $4, 'student', $5, $6, $7)`,
      [userId, a.email, a.passwordHash, a.name, professionalId, a.avatarColor, hoje],
    );
    await q(
      `INSERT INTO students (id, user_id, professional_id, birth_date, phone, modality, goal, status, start_date, training_days, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo', $8, $9::smallint[], $10)`,
      [studentId, userId, professionalId, a.birthDate || null, a.phone, a.modality, a.goal, hoje, a.trainingDays, a.notes],
    );
    await q(
      `INSERT INTO anamnesis (id, student_id, professional_id, answered_at, answers)
       VALUES ($1, $2, $3, NULL, '{}'::jsonb)`,
      [id("anm"), studentId, professionalId],
    );
    await q(
      `INSERT INTO training_plans (id, student_id, professional_id, name, goal, start_date, end_date, active)
       VALUES ($1, $2, $3, 'Bloco inicial', $4, $5, $6, TRUE)`,
      [id("plan"), studentId, professionalId, a.goal, hoje, a.planEnd],
    );
    await q(
      `INSERT INTO checkins (id, student_id, professional_id, week_start, status)
       VALUES ($1, $2, $3, $4, 'pendente') ON CONFLICT (student_id, week_start) DO NOTHING`,
      [id("chk"), studentId, professionalId, currentWeekStart()],
    );
    await q(
      `INSERT INTO notifications (id, user_id, title, body, link, read, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6)`,
      [id("ntf"), userId, "Bem-vindo à Vision Fitness",
       "Comece respondendo sua anamnese para o Lucas montar seu treino.", "/aluno/anamnese", hoje],
    );
  });

  return studentId;
}

export async function emailEmUso(email: string, exceptUserId?: string): Promise<boolean> {
  const r = await sqlOne(
    `SELECT 1 AS x FROM users WHERE lower(email) = lower($1) AND ($2::text IS NULL OR id <> $2)`,
    [email, exceptUserId ?? null],
  );
  return r !== null;
}

export async function updateStudent(
  studentId: string,
  name: string,
  s: { modality: Modality; goal: string; phone: string; birthDate: string; status: StudentStatus; notes: string; trainingDays: number[] },
) {
  await transaction(async (q) => {
    await q(
      `UPDATE students SET modality = $2, goal = $3, phone = $4,
              birth_date = COALESCE($5, birth_date), status = $6, notes = $7,
              training_days = CASE WHEN array_length($8::smallint[], 1) IS NULL
                                   THEN training_days ELSE $8::smallint[] END
        WHERE id = $1`,
      [studentId, s.modality, s.goal, s.phone, s.birthDate || null, s.status, s.notes, s.trainingDays],
    );
    if (name) {
      await q(`UPDATE users SET name = $2 WHERE id = (SELECT user_id FROM students WHERE id = $1)`,
        [studentId, name]);
    }
  });
}

export async function updatePasswordHash(userId: string, hash: string) {
  await sql("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, hash]);
}

export async function updateAccount(userId: string, name: string, email: string, passwordHash?: string) {
  await sql(
    `UPDATE users SET name = $2, email = $3,
            password_hash = COALESCE($4, password_hash) WHERE id = $1`,
    [userId, name, email, passwordHash ?? null],
  );
}

/* -------------------------------------------------------------- exercícios */

export interface ExercicioInput {
  name: string; muscleGroup: string; equipment: string; videoUrl: string;
  instructions: string; commonMistakes: string; tips: string;
}

export async function upsertExercise(professionalId: string, exerciseId: string | null, e: ExercicioInput) {
  if (exerciseId) {
    await sql(
      `UPDATE exercises SET name = $2, muscle_group = $3, equipment = $4, video_url = $5,
              instructions = $6, common_mistakes = $7, tips = $8 WHERE id = $1`,
      [exerciseId, e.name, e.muscleGroup, e.equipment, e.videoUrl, e.instructions, e.commonMistakes, e.tips],
    );
    return exerciseId;
  }
  const novo = id("ex");
  await sql(
    `INSERT INTO exercises (id, professional_id, name, muscle_group, equipment, video_url, instructions, common_mistakes, tips)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [novo, professionalId, e.name, e.muscleGroup, e.equipment, e.videoUrl, e.instructions, e.commonMistakes, e.tips],
  );
  return novo;
}

export async function deleteExercise(exerciseId: string) {
  const emUso = await sqlOne(
    "SELECT 1 AS x FROM workout_exercises WHERE exercise_id = $1 LIMIT 1", [exerciseId],
  );
  if (emUso) throw new Error("Exercício em uso em algum treino.");
  await sql("DELETE FROM exercises WHERE id = $1", [exerciseId]);
}

/* ----------------------------------------------------------------- treinos */

export async function ensureActivePlan(studentId: string, professionalId: string, endDate: string) {
  const existente = await sqlOne<{ id: string }>(
    "SELECT id FROM training_plans WHERE student_id = $1 AND active ORDER BY start_date DESC LIMIT 1",
    [studentId],
  );
  if (existente) return existente.id;

  const planId = id("plan");
  await sql(
    `INSERT INTO training_plans (id, student_id, professional_id, name, goal, start_date, end_date, active)
     VALUES ($1, $2, $3, 'Bloco atual', '', $4, $5, TRUE)`,
    [planId, studentId, professionalId, todayISO(), endDate],
  );
  return planId;
}

export async function insertWorkout(
  planId: string,
  w: { label: string; name: string; weekdays: number[]; estimatedMinutes: number },
) {
  const [{ n }] = await sql<{ n: string }>(
    "SELECT count(*) AS n FROM workouts WHERE plan_id = $1", [planId],
  );
  const ordem = Number(n);
  await sql(
    `INSERT INTO workouts (id, plan_id, label, name, weekdays, order_index, estimated_minutes)
     VALUES ($1, $2, $3, $4, $5::smallint[], $6, $7)`,
    [id("wk"), planId, w.label || String.fromCharCode(65 + ordem), w.name, w.weekdays, ordem, w.estimatedMinutes],
  );
}

export async function deleteWorkout(workoutId: string) {
  // sessões, séries e exercícios do treino caem por ON DELETE CASCADE
  await sql("DELETE FROM workouts WHERE id = $1", [workoutId]);
}

export interface ItemTreino {
  sets: number; repsMin: number; repsMax: number; load: number;
  restSeconds: number; rir: number; cadence: string; method: string; notes: string;
}

export async function insertWorkoutExercise(workoutId: string, exerciseId: string, i: ItemTreino) {
  const [{ n }] = await sql<{ n: string }>(
    "SELECT count(*) AS n FROM workout_exercises WHERE workout_id = $1", [workoutId],
  );
  await sql(
    `INSERT INTO workout_exercises
       (id, workout_id, exercise_id, order_index, sets, reps_min, reps_max, load, rest_seconds, rir, cadence, method, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id("we"), workoutId, exerciseId, Number(n), i.sets, i.repsMin, i.repsMax,
     i.load, i.restSeconds, i.rir, i.cadence, i.method, i.notes],
  );
}

export async function updateWorkoutExercise(itemId: string, i: Partial<ItemTreino>) {
  await sql(
    `UPDATE workout_exercises SET
        sets = COALESCE($2, sets), reps_min = COALESCE($3, reps_min),
        reps_max = COALESCE($4, reps_max), load = COALESCE($5, load),
        rest_seconds = COALESCE($6, rest_seconds), rir = COALESCE($7, rir),
        notes = $8
      WHERE id = $1`,
    [itemId, i.sets ?? null, i.repsMin ?? null, i.repsMax ?? null, i.load ?? null,
     i.restSeconds ?? null, i.rir ?? null, i.notes ?? ""],
  );
}

export async function deleteWorkoutExercise(itemId: string) {
  await sql("DELETE FROM workout_exercises WHERE id = $1", [itemId]);
}

/* ------------------------------------------------------- execução do treino */

export interface SerieRegistrada {
  workoutExerciseId: string;
  setNumber: number;
  load: number;
  reps: number;
  rpe: number | null;
}

export async function insertSession(args: {
  studentId: string;
  professionalId: string;
  studentName: string;
  workoutId: string;
  startedAt: string;
  rpe: number | null;
  notes: string;
  sets: SerieRegistrada[];
  registraPresenca: boolean;
}) {
  const sessionId = id("ses");
  const hoje = todayISO();

  await transaction(async (q) => {
    await q(
      `INSERT INTO workout_sessions (id, student_id, workout_id, started_at, finished_at, session_date, rpe, notes)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)`,
      [sessionId, args.studentId, args.workoutId, args.startedAt, hoje, args.rpe, args.notes],
    );

    for (const s of args.sets) {
      await q(
        `INSERT INTO workout_sets (id, session_id, workout_exercise_id, set_number, load, reps, rpe, done_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [id("set"), sessionId, s.workoutExerciseId, s.setNumber, s.load, s.reps, s.rpe],
      );
      // a carga usada vira a referência da próxima sessão
      if (s.load > 0) {
        await q("UPDATE workout_exercises SET load = $2 WHERE id = $1", [s.workoutExerciseId, s.load]);
      }
    }

    if (args.registraPresenca) {
      await q(
        `INSERT INTO attendance (id, student_id, professional_id, date, present)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (student_id, date) DO UPDATE SET present = TRUE`,
        [id("att"), args.studentId, args.professionalId, hoje],
      );
    }

    await q(
      `INSERT INTO notifications (id, user_id, title, body, link, read, created_at)
       VALUES ($1, $2, 'Treino concluído', $3, $4, FALSE, $5)`,
      [id("ntf"), args.professionalId, `${args.studentName} finalizou o treino de hoje.`,
       `/app/alunos/${args.studentId}`, hoje],
    );
  });
}

/* ---------------------------------------------------------------- check-in */

export async function ensureCheckin(studentId: string, professionalId: string, weekStart: string) {
  await sql(
    `INSERT INTO checkins (id, student_id, professional_id, week_start, status)
     VALUES ($1, $2, $3, $4, 'pendente')
     ON CONFLICT (student_id, week_start) DO NOTHING`,
    [id("chk"), studentId, professionalId, weekStart],
  );
}

export async function answerCheckin(args: {
  studentId: string;
  professionalId: string;
  studentName: string;
  weekStart: string;
  answers: CheckinAnswers;
}) {
  await transaction(async (q) => {
    await q(
      `INSERT INTO checkins (id, student_id, professional_id, week_start, status, answered_at, answers)
       VALUES ($1, $2, $3, $4, 'respondido', $5, $6::jsonb)
       ON CONFLICT (student_id, week_start)
       DO UPDATE SET status = 'respondido', answered_at = EXCLUDED.answered_at, answers = EXCLUDED.answers`,
      [id("chk"), args.studentId, args.professionalId, args.weekStart, todayISO(), JSON.stringify(args.answers)],
    );
    await q(
      `INSERT INTO notifications (id, user_id, title, body, link, read, created_at)
       VALUES ($1, $2, 'Check-in respondido', $3, $4, FALSE, $5)`,
      [id("ntf"), args.professionalId, `${args.studentName} enviou o check-in da semana.`,
       `/app/alunos/${args.studentId}?tab=checkins`, todayISO()],
    );
  });
}

export async function replyCheckin(checkinId: string, studentUserId: string, reply: string) {
  await transaction(async (q) => {
    await q("UPDATE checkins SET coach_reply = $2 WHERE id = $1", [checkinId, reply]);
    await q(
      `INSERT INTO notifications (id, user_id, title, body, link, read, created_at)
       VALUES ($1, $2, 'Seu personal respondeu seu check-in', $3, '/aluno/checkin', FALSE, $4)`,
      [id("ntf"), studentUserId, reply.slice(0, 120), todayISO()],
    );
  });
}

/* -------------------------------------------------------------- avaliações */

export async function insertAssessment(a: {
  studentId: string; professionalId: string; date: string;
  weight: number | null; height: number | null; bodyFat: number | null; muscleMass: number | null;
  measurements: Measurements; notes: string;
}) {
  await sql(
    `INSERT INTO assessments (id, student_id, professional_id, date, weight, height, body_fat, muscle_mass, measurements, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
    [id("asm"), a.studentId, a.professionalId, a.date, a.weight, a.height,
     a.bodyFat, a.muscleMass, JSON.stringify(a.measurements), a.notes],
  );
}

/* --------------------------------------------------------------- presença */

export async function markAttendance(
  studentId: string, professionalId: string, date: string, present: boolean,
) {
  await sql(
    `INSERT INTO attendance (id, student_id, professional_id, date, present)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id, date) DO UPDATE SET present = EXCLUDED.present`,
    [id("att"), studentId, professionalId, date, present],
  );
}

/* ---------------------------------------------------------------- hábitos */

const CAMPOS_HABITO = ["water", "nutrition", "sleep", "steps", "supplement"] as const;
export type CampoHabito = (typeof CAMPOS_HABITO)[number];

export async function toggleHabit(studentId: string, date: string, field: CampoHabito) {
  if (!CAMPOS_HABITO.includes(field)) throw new Error("Hábito desconhecido.");
  // o nome da coluna vem de uma lista fechada, nunca do texto recebido
  await sql(
    `INSERT INTO habit_logs (id, student_id, date, ${field})
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (student_id, date) DO UPDATE SET ${field} = NOT habit_logs.${field}`,
    [id("hab"), studentId, date],
  );
}

/* ----------------------------------------------------------------- fotos */

export async function upsertPhoto(args: {
  studentId: string; professionalId: string; studentName: string;
  month: string; angle: PhotoAngle; fileName: string;
}) {
  await transaction(async (q) => {
    await q(
      `INSERT INTO progress_photos (id, student_id, month, angle, file_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, month, angle)
       DO UPDATE SET file_name = EXCLUDED.file_name, created_at = NOW()`,
      [id("pht"), args.studentId, args.month, args.angle, args.fileName],
    );
    await q(
      `INSERT INTO notifications (id, user_id, title, body, link, read, created_at)
       VALUES ($1, $2, 'Nova foto de evolução', $3, $4, FALSE, $5)`,
      [id("ntf"), args.professionalId, `${args.studentName} registrou a foto de ${args.angle}.`,
       `/app/alunos/${args.studentId}?tab=evolucao`, todayISO()],
    );
  });
}

/** Nome do arquivo anterior naquele mês/ângulo, para apagar do storage. */
export async function photoFileName(studentId: string, month: string, angle: PhotoAngle) {
  const r = await sqlOne<{ file_name: string }>(
    "SELECT file_name FROM progress_photos WHERE student_id = $1 AND month = $2 AND angle = $3",
    [studentId, month, angle],
  );
  return r?.file_name ?? null;
}

/* -------------------------------------------------------------- anamnese */

export async function saveAnamnesis(
  studentId: string, professionalId: string, answers: Record<string, string>,
) {
  const anterior = await sqlOne<{ answered_at: unknown }>(
    "SELECT answered_at FROM anamnesis WHERE student_id = $1", [studentId],
  );
  const primeira = !anterior?.answered_at;

  await sql(
    `INSERT INTO anamnesis (id, student_id, professional_id, answered_at, answers)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (student_id)
     DO UPDATE SET answered_at = EXCLUDED.answered_at,
                   answers = anamnesis.answers || EXCLUDED.answers`,
    [id("anm"), studentId, professionalId, todayISO(), JSON.stringify(answers)],
  );
  return primeira;
}

/* ---------------------------------------------------------- notificações */

export async function notify(userId: string, title: string, body: string, link: string) {
  await sql(
    `INSERT INTO notifications (id, user_id, title, body, link, read, created_at)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6)`,
    [id("ntf"), userId, title, body, link, todayISO()],
  );
}

export async function markNotificationsRead(userId: string) {
  await sql("UPDATE notifications SET read = TRUE WHERE user_id = $1", [userId]);
}

export async function clearNotifications(userId: string) {
  await sql("DELETE FROM notifications WHERE user_id = $1", [userId]);
}
