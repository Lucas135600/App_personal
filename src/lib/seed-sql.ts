import type { Querier } from "./sql";
import { buildSeed } from "./seed";

/* Popula um banco vazio com os dados de demonstração.
   Reaproveita o buildSeed() que já existia: ele continua sendo a fonte única
   dos dados de exemplo, e aqui só os gravamos em SQL. */

/** Insere em lotes; uma linha por vez deixaria o seed de milhares de séries lento. */
async function insertMany(
  q: Querier,
  table: string,
  columns: string[],
  rows: unknown[][],
  casts: Record<string, string> = {},
) {
  if (rows.length === 0) return;
  const LOTE = 400;

  for (let start = 0; start < rows.length; start += LOTE) {
    const chunk = rows.slice(start, start + LOTE);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value, i) => {
        values.push(value);
        const cast = casts[columns[i]];
        return cast ? `$${values.length}::${cast}` : `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    await q(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${tuples.join(", ")}
       ON CONFLICT DO NOTHING`,
      values,
    );
  }
}

const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));

export async function seedDatabase(q: Querier): Promise<void> {
  const db = buildSeed();

  await insertMany(
    q, "users",
    ["id", "email", "password_hash", "name", "role", "professional_id", "avatar_color",
     "created_at", "must_change_password", "is_admin"],
    // O personal precisa existir antes dos alunos por causa da FK professional_id.
    [...db.users].sort((a) => (a.role === "personal" ? -1 : 1))
      .map((u) => [u.id, u.email, u.passwordHash, u.name, u.role, u.professionalId,
                   u.avatarColor, u.createdAt, u.mustChangePassword, u.isAdmin]),
  );

  await insertMany(
    q, "students",
    ["id", "user_id", "professional_id", "birth_date", "phone", "modality", "goal", "status", "start_date", "training_days", "notes", "public_profile"],
    db.students.map((s) => [
      s.id, s.userId, s.professionalId, s.birthDate, s.phone, s.modality,
      s.goal, s.status, s.startDate, s.trainingDays, s.notes, s.publicProfile,
    ]),
    { training_days: "smallint[]" },
  );

  await insertMany(
    q, "exercises",
    ["id", "professional_id", "name", "muscle_group", "equipment", "video_url", "instructions", "common_mistakes", "tips"],
    db.exercises.map((e) => [
      e.id, e.professionalId, e.name, e.muscleGroup, e.equipment,
      e.videoUrl, e.instructions, e.commonMistakes, e.tips,
    ]),
  );

  await insertMany(
    q, "training_plans",
    ["id", "student_id", "professional_id", "name", "goal", "start_date", "end_date", "active"],
    db.trainingPlans.map((p) => [
      p.id, p.studentId, p.professionalId, p.name, p.goal, p.startDate, p.endDate, p.active,
    ]),
  );

  await insertMany(
    q, "workouts",
    ["id", "plan_id", "label", "name", "weekdays", "order_index", "estimated_minutes"],
    db.workouts.map((w) => [w.id, w.planId, w.label, w.name, w.weekdays, w.orderIndex, w.estimatedMinutes]),
    { weekdays: "smallint[]" },
  );

  await insertMany(
    q, "workout_exercises",
    ["id", "workout_id", "exercise_id", "order_index", "sets", "reps_min", "reps_max", "load", "rest_seconds", "rir", "cadence", "method", "notes"],
    db.workoutExercises.map((we) => [
      we.id, we.workoutId, we.exerciseId, we.orderIndex, we.sets, we.repsMin, we.repsMax,
      we.load, we.restSeconds, we.rir, we.cadence, we.method, we.notes,
    ]),
  );

  await insertMany(
    q, "workout_sessions",
    ["id", "student_id", "workout_id", "started_at", "finished_at", "session_date", "rpe", "notes"],
    db.workoutSessions.map((s) => [
      s.id, s.studentId, s.workoutId, s.startedAt, s.finishedAt,
      s.startedAt.slice(0, 10), s.rpe, s.notes,
    ]),
  );

  await insertMany(
    q, "workout_sets",
    ["id", "session_id", "workout_exercise_id", "set_number", "load", "reps", "rpe", "done_at"],
    db.workoutSets.map((s) => [
      s.id, s.sessionId, s.workoutExerciseId, s.setNumber, s.load, s.reps, s.rpe, s.doneAt,
    ]),
  );

  await insertMany(
    q, "checkins",
    ["id", "student_id", "professional_id", "week_start", "status", "answered_at", "answers", "coach_reply"],
    db.checkins.map((c) => [
      c.id, c.studentId, c.professionalId, c.weekStart, c.status,
      c.answeredAt, json(c.answers), c.coachReply,
    ]),
    { answers: "jsonb" },
  );

  await insertMany(
    q, "assessments",
    ["id", "student_id", "professional_id", "date", "weight", "height", "body_fat", "muscle_mass", "measurements", "notes"],
    db.assessments.map((a) => [
      a.id, a.studentId, a.professionalId, a.date, a.weight, a.height,
      a.bodyFat, a.muscleMass, json(a.measurements), a.notes,
    ]),
    { measurements: "jsonb" },
  );

  await insertMany(
    q, "progress_photos",
    ["id", "student_id", "month", "angle", "file_name", "created_at"],
    db.progressPhotos.map((p) => [p.id, p.studentId, p.month, p.angle, p.fileName, p.createdAt]),
  );

  await insertMany(
    q, "habit_logs",
    ["id", "student_id", "date", "water", "nutrition", "sleep", "steps", "supplement", "notes"],
    db.habitLogs.map((h) => [
      h.id, h.studentId, h.date, h.water, h.nutrition, h.sleep, h.steps, h.supplement, h.notes,
    ]),
  );

  await insertMany(
    q, "habit_targets",
    ["id", "student_id", "professional_id", "water_ml", "nutrition", "supplement", "updated_at"],
    db.habitTargets.map((t) => [
      t.id, t.studentId, t.professionalId, t.waterMl, t.nutrition, t.supplement, t.updatedAt,
    ]),
  );

  await insertMany(
    q, "consents",
    ["id", "student_id", "kind", "granted", "version", "decided_at"],
    db.consents.map((c) => [c.id, c.studentId, c.kind, c.granted, c.version, c.decidedAt]),
  );

  await insertMany(
    q, "challenges",
    ["id", "professional_id", "created_by", "name", "kind", "goal", "period", "target",
     "require_photo", "start_date", "end_date", "status", "created_at"],
    db.challenges.map((c) => [
      c.id, c.professionalId, c.createdBy, c.name, c.kind, c.goal, c.period, c.target,
      c.requirePhoto, c.startDate, c.endDate, c.status, c.createdAt,
    ]),
  );

  await insertMany(
    q, "challenge_members",
    ["id", "challenge_id", "student_id", "status", "responded_at"],
    db.challengeMembers.map((m) => [m.id, m.challengeId, m.studentId, m.status, m.respondedAt]),
  );

  await insertMany(
    q, "challenge_entries",
    ["id", "challenge_id", "student_id", "date", "value", "photo_file_name", "note", "created_at"],
    db.challengeEntries.map((e) => [
      e.id, e.challengeId, e.studentId, e.date, e.value, e.photoFileName, e.note, e.createdAt,
    ]),
  );

  await insertMany(
    q, "subscription_plans",
    ["id", "name", "months", "price_cents", "list_price_cents", "installments",
     "description", "active", "order_index"],
    db.subscriptionPlans.map((p) => [
      p.id, p.name, p.months, p.priceCents, p.listPriceCents, p.installments,
      p.description, p.active, p.orderIndex,
    ]),
  );

  await insertMany(
    q, "attendance",
    ["id", "student_id", "professional_id", "date", "present", "notes"],
    db.attendance.map((a) => [a.id, a.studentId, a.professionalId, a.date, a.present, a.notes]),
  );

  await insertMany(
    q, "anamnesis",
    ["id", "student_id", "professional_id", "answered_at", "answers"],
    db.anamnesis.map((a) => [a.id, a.studentId, a.professionalId, a.answeredAt, json(a.answers)]),
    { answers: "jsonb" },
  );

  await insertMany(
    q, "notifications",
    ["id", "user_id", "title", "body", "link", "read", "created_at"],
    db.notifications.map((n) => [n.id, n.userId, n.title, n.body, n.link, n.read, n.createdAt]),
  );
}
