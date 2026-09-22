import { getDb } from "./scope";
import { addDays, currentMonth, currentWeekStart, daysSince, monthGrid, todayISO, weekStart } from "./dates";
import type {
  Assessment, Checkin, Exercise, Modality, Student, User, Workout, WorkoutExercise,
} from "./types";

export interface Alert {
  level: "warn" | "danger";
  label: string;
}

export interface Adherence {
  workouts: number;
  checkins: number;
  habits: number;
  overall: number;
}

export interface StudentView {
  student: Student;
  user: User;
  age: number;
  lastSessionDate: string | null;
  daysWithoutTraining: number | null;
  plannedLast4Weeks: number;
  doneLast4Weeks: number;
  frequency: number;
  currentCheckin: Checkin | null;
  lastAnsweredCheckin: Checkin | null;
  lastAssessment: Assessment | null;
  firstAssessment: Assessment | null;
  weight: number | null;
  weightDelta: number | null;
  waistDelta: number | null;
  photoMonths: string[];
  hasPhotoThisMonth: boolean;
  adherence: Adherence;
  alerts: Alert[];
}

const ASSESSMENT_VALID_DAYS = 90;

export async function buildStudentView(studentId: string): Promise<StudentView | null> {
  const db = await getDb();
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return null;
  const user = db.users.find((u) => u.id === student.userId)!;
  const today = todayISO();

  const sessions = db.workoutSessions
    .filter((s) => s.studentId === studentId && s.finishedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const lastSession = sessions[sessions.length - 1] ?? null;
  const lastSessionDate = lastSession ? lastSession.startedAt.slice(0, 10) : null;

  const since = addDays(today, -28);
  const doneLast4Weeks = sessions.filter((s) => s.startedAt.slice(0, 10) >= since).length;
  const plannedLast4Weeks = Math.max(1, student.trainingDays.length * 4);
  const frequency = Math.min(100, Math.round((doneLast4Weeks / plannedLast4Weeks) * 100));

  const checkins = db.checkins
    .filter((c) => c.studentId === studentId)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const thisWeek = currentWeekStart();
  const currentCheckin = checkins.find((c) => c.weekStart === thisWeek) ?? null;
  const answered = checkins.filter((c) => c.status === "respondido");
  const lastAnsweredCheckin = answered[answered.length - 1] ?? null;
  const last6 = checkins.slice(-6);
  const checkinRate = last6.length
    ? Math.round((last6.filter((c) => c.status === "respondido").length / last6.length) * 100)
    : 0;

  const assessments = db.assessments
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastAssessment = assessments[assessments.length - 1] ?? null;
  const firstAssessment = assessments[0] ?? null;

  const weight = lastAnsweredCheckin?.answers?.weight ?? lastAssessment?.weight ?? null;
  const weightDelta =
    firstAssessment?.weight != null && weight != null
      ? Number((weight - firstAssessment.weight).toFixed(1))
      : null;
  const waistDelta =
    firstAssessment?.measurements.cintura != null && lastAssessment?.measurements.cintura != null
      ? Number((lastAssessment.measurements.cintura - firstAssessment.measurements.cintura).toFixed(1))
      : null;

  const photoMonths = Array.from(
    new Set(db.progressPhotos.filter((p) => p.studentId === studentId).map((p) => p.month)),
  ).sort();
  const hasPhotoThisMonth = photoMonths.includes(currentMonth());

  const habits = db.habitLogs.filter((h) => h.studentId === studentId && h.date >= addDays(today, -14));
  // Denominador são as marcações respondidas, não todas as possíveis: dia em
  // branco é ausência de dado, e contá-lo como falha puniria quem esquece de
  // marcar tanto quanto quem realmente não cumpriu.
  const marcacoes = habits.flatMap((h) => [h.water, h.nutrition, h.sleep, h.steps]);
  const respondidas = marcacoes.filter((v) => v !== 0);
  const habitScore = respondidas.length
    ? Math.round((respondidas.filter((v) => v === 1).length / respondidas.length) * 100)
    : 0;

  const adherence: Adherence = {
    workouts: frequency,
    checkins: checkinRate,
    habits: habitScore,
    overall: Math.round(frequency * 0.5 + checkinRate * 0.3 + habitScore * 0.2),
  };

  const alerts: Alert[] = [];
  const dwt = daysSince(lastSessionDate);
  // Aluno recem-cadastrado ainda não tem histórico: não faz sentido cobrar
  // frequência ou atraso de check-in nas duas primeiras semanas.
  const onboarding = (daysSince(student.startDate) ?? 0) < 14;

  if (currentCheckin && currentCheckin.status !== "respondido" && !onboarding) {
    const overdue = (daysSince(thisWeek) ?? 0) >= 5;
    alerts.push({
      level: overdue ? "danger" : "warn",
      label: overdue ? "Check-in da semana atrasado" : "Check-in da semana pendente",
    });
  }
  if (dwt != null && dwt >= 5 && !onboarding) {
    alerts.push({ level: dwt >= 10 ? "danger" : "warn", label: `Sem treinar há ${dwt} dias` });
  }
  if (lastAssessment) {
    const d = daysSince(lastAssessment.date) ?? 0;
    if (d > ASSESSMENT_VALID_DAYS) {
      alerts.push({ level: "danger", label: "Avaliação física vencida" });
    } else if (d > ASSESSMENT_VALID_DAYS - 14) {
      alerts.push({ level: "warn", label: `Avaliação vence em ${ASSESSMENT_VALID_DAYS - d} dias` });
    }
  } else {
    alerts.push({ level: "warn", label: "Sem avaliação inicial" });
  }
  if (!hasPhotoThisMonth && !onboarding) {
    alerts.push({ level: "warn", label: "Foto mensal pendente" });
  }
  if (frequency < 60 && !onboarding) {
    alerts.push({ level: "danger", label: `Frequência baixa (${frequency}%)` });
  }

  return {
    student, user,
    age: ageFrom(student.birthDate),
    lastSessionDate,
    daysWithoutTraining: dwt,
    plannedLast4Weeks, doneLast4Weeks, frequency,
    currentCheckin, lastAnsweredCheckin,
    lastAssessment, firstAssessment,
    weight, weightDelta, waistDelta,
    photoMonths, hasPhotoThisMonth,
    adherence, alerts,
  };
}

function ageFrom(birthDate: string): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  const b = new Date(y, m - 1, d);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const mm = t.getMonth() - b.getMonth();
  if (mm < 0 || (mm === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

export async function listStudentViews(professionalId: string): Promise<StudentView[]> {
  const db = await getDb();
  const views = await Promise.all(
    db.students
      .filter((s) => s.professionalId === professionalId)
      .map((s) => buildStudentView(s.id)),
  );
  return views
    .filter((v): v is StudentView => v !== null)
    .sort((a, b) => a.user.name.localeCompare(b.user.name));
}

export interface DashboardData {
  views: StudentView[];
  total: number;
  presencial: number;
  online: number;
  hibrido: number;
  trainedToday: number;
  scheduledToday: number;
  checkinsAnswered: number;
  checkinsPending: number;
  checkinsLate: number;
  avgFrequency: number;
  attention: Array<{ view: StudentView; alerts: Alert[] }>;
  assessmentsDue: number;
}

export async function buildDashboard(professionalId: string): Promise<DashboardData> {
  const views = await listStudentViews(professionalId);
  const db = await getDb();
  const today = todayISO();
  const dow = new Date(`${today}T12:00:00`).getDay();

  const scheduledToday = views.filter((v) => v.student.trainingDays.includes(dow)).length;
  const trainedToday = db.workoutSessions.filter(
    (s) => s.startedAt.slice(0, 10) === today && s.finishedAt,
  ).length;

  const thisWeek = currentWeekStart();
  const weekCheckins = db.checkins.filter(
    (c) => c.professionalId === professionalId && c.weekStart === thisWeek,
  );
  const lateCheckins = db.checkins.filter(
    (c) => c.professionalId === professionalId && c.status === "atrasado" && c.weekStart >= addDays(thisWeek, -28),
  );

  const avgFrequency = views.length
    ? Math.round(views.reduce((acc, v) => acc + v.frequency, 0) / views.length)
    : 0;

  const attention = views
    .filter((v) => v.alerts.some((a) => a.level === "danger") || v.alerts.length >= 2)
    .map((v) => ({ view: v, alerts: v.alerts }))
    .sort((a, b) => {
      const score = (x: typeof a) => x.alerts.filter((al) => al.level === "danger").length * 10 + x.alerts.length;
      return score(b) - score(a);
    });

  return {
    views,
    total: views.length,
    presencial: views.filter((v) => v.student.modality === "presencial").length,
    online: views.filter((v) => v.student.modality === "online").length,
    hibrido: views.filter((v) => v.student.modality === "hibrido").length,
    trainedToday,
    scheduledToday,
    checkinsAnswered: weekCheckins.filter((c) => c.status === "respondido").length,
    checkinsPending: weekCheckins.filter((c) => c.status === "pendente").length,
    checkinsLate: lateCheckins.length,
    avgFrequency,
    attention,
    assessmentsDue: views.filter((v) =>
      v.alerts.some((a) => a.label.startsWith("Avaliação")),
    ).length,
  };
}

export interface ResolvedExercise {
  item: WorkoutExercise;
  exercise: Exercise;
  lastLoad: number | null;
  lastReps: number | null;
}

export interface ResolvedWorkout {
  workout: Workout;
  items: ResolvedExercise[];
  totalSets: number;
}

export async function resolveWorkout(workoutId: string, studentId: string): Promise<ResolvedWorkout | null> {
  const db = await getDb();
  const workout = db.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;

  const sessionIds = new Set(
    db.workoutSessions
      .filter((s) => s.studentId === studentId && s.workoutId === workoutId && s.finishedAt)
      .map((s) => s.id),
  );

  const items = db.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => {
      const sets = db.workoutSets
        .filter((s) => s.workoutExerciseId === item.id && sessionIds.has(s.sessionId))
        .sort((a, b) => b.doneAt.localeCompare(a.doneAt));
      return {
        item,
        exercise: db.exercises.find((e) => e.id === item.exerciseId)!,
        lastLoad: sets[0]?.load ?? null,
        lastReps: sets[0]?.reps ?? null,
      };
    });

  return { workout, items, totalSets: items.reduce((acc, i) => acc + i.item.sets, 0) };
}

export async function activePlanWorkouts(studentId: string): Promise<{ planName: string; workouts: Workout[] }> {
  const db = await getDb();
  const plan = db.trainingPlans.find((p) => p.studentId === studentId && p.active);
  if (!plan) return { planName: "", workouts: [] };
  return {
    planName: plan.name,
    workouts: db.workouts
      .filter((w) => w.planId === plan.id)
      .sort((a, b) => a.orderIndex - b.orderIndex),
  };
}

/** Próximo treino: o do dia da semana, senão o que há mais tempo não é feito. */
export async function nextWorkoutFor(studentId: string): Promise<Workout | null> {
  const db = await getDb();
  const { workouts } = await activePlanWorkouts(studentId);
  if (!workouts.length) return null;

  const dow = new Date(`${todayISO()}T12:00:00`).getDay();
  const scheduled = workouts.find((w) => w.weekdays.includes(dow));
  if (scheduled) return scheduled;

  const lastByWorkout = new Map<string, string>();
  for (const s of db.workoutSessions.filter((s) => s.studentId === studentId && s.finishedAt)) {
    const prev = lastByWorkout.get(s.workoutId);
    if (!prev || s.startedAt > prev) lastByWorkout.set(s.workoutId, s.startedAt);
  }
  return [...workouts].sort(
    (a, b) => (lastByWorkout.get(a.id) ?? "").localeCompare(lastByWorkout.get(b.id) ?? ""),
  )[0];
}

export interface WeeklyPoint {
  weekStart: string;
  planned: number;
  done: number;
}

export async function weeklyFrequency(studentId: string, weeks = 8): Promise<WeeklyPoint[]> {
  const db = await getDb();
  const student = db.students.find((s) => s.id === studentId)!;
  const start = currentWeekStart();
  const points: WeeklyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(start, -7 * i);
    const we = addDays(ws, 6);
    const done = db.workoutSessions.filter(
      (s) =>
        s.studentId === studentId &&
        s.finishedAt &&
        s.startedAt.slice(0, 10) >= ws &&
        s.startedAt.slice(0, 10) <= we,
    ).length;
    points.push({ weekStart: ws, planned: student.trainingDays.length, done });
  }
  return points;
}

/** Série temporal de peso combinando avaliações e check-ins. */
export async function weightSeries(studentId: string): Promise<Array<{ date: string; value: number }>> {
  const db = await getDb();
  const points: Array<{ date: string; value: number }> = [];
  for (const a of db.assessments.filter((a) => a.studentId === studentId)) {
    if (a.weight != null) points.push({ date: a.date, value: a.weight });
  }
  for (const c of db.checkins.filter((c) => c.studentId === studentId)) {
    if (c.answers?.weight != null) points.push({ date: c.weekStart, value: c.answers.weight });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export async function measurementSeries(
  studentId: string,
  key: keyof Assessment["measurements"],
): Promise<Array<{ date: string; value: number }>> {
  const db = await getDb();
  return db
    .assessments.filter((a) => a.studentId === studentId && a.measurements[key] != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({ date: a.date, value: a.measurements[key]! }));
}

export async function checkinHistory(studentId: string, limit = 8): Promise<Checkin[]> {
  const db = await getDb();
  return db
    .checkins.filter((c) => c.studentId === studentId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, limit);
}


export function weekStartOf(iso: string) {
  return weekStart(iso);
}

/* ------------------------------------------------------- agenda / calendário */

export interface AgendaStudent {
  studentId: string;
  name: string;
  color: string;
  modality: Modality;
  /** Presencial e híbrido ocupam horário do personal; online, não. */
  ocupaHorario: boolean;
}

export interface AgendaDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  scheduled: AgendaStudent[];
  presentIds: string[];
  absentIds: string[];
  trainedIds: string[];
}

export interface AgendaTotals {
  presenciaisPrevistas: number;
  presenciaisRealizadas: number;
  faltas: number;
  treinosOnline: number;
}

export interface AgendaData {
  month: string;
  weeks: AgendaDay[][];
  mes: AgendaTotals;
  semana: AgendaTotals;
  porAluno: Array<{
    student: AgendaStudent;
    previstas: number;
    realizadas: number;
    faltas: number;
  }>;
}

function emptyTotals(): AgendaTotals {
  return { presenciaisPrevistas: 0, presenciaisRealizadas: 0, faltas: 0, treinosOnline: 0 };
}

export async function buildAgenda(professionalId: string, month: string): Promise<AgendaData> {
  const db = await getDb();
  const today = todayISO();

  const alunos: AgendaStudent[] = db.students
    .filter((s) => s.professionalId === professionalId && s.status === "ativo")
    .map((s) => ({
      studentId: s.id,
      name: db.users.find((u) => u.id === s.userId)?.name ?? "Aluno",
      color: db.users.find((u) => u.id === s.userId)?.avatarColor ?? "#9aa1ac",
      modality: s.modality,
      ocupaHorario: s.modality !== "online",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const byId = new Map(db.students.map((s) => [s.id, s]));
  const thisWeek = currentWeekStart();
  const mes = emptyTotals();
  const semana = emptyTotals();
  const porAluno = new Map(
    alunos.map((a) => [a.studentId, { student: a, previstas: 0, realizadas: 0, faltas: 0 }]),
  );

  const weeks = monthGrid(month).map((week) =>
    week.map<AgendaDay>((date) => {
      const dow = new Date(`${date}T12:00:00`).getDay();
      const inMonth = date.slice(0, 7) === month;

      // Só conta como previsto a partir da data de entrada do aluno.
      const scheduled = alunos.filter((a) => {
        const s = byId.get(a.studentId)!;
        return s.trainingDays.includes(dow) && date >= s.startDate;
      });

      const dayAttendance = db.attendance.filter(
        (x) => x.professionalId === professionalId && x.date === date,
      );
      const presentIds = dayAttendance.filter((x) => x.present).map((x) => x.studentId);
      const absentIds = dayAttendance.filter((x) => !x.present).map((x) => x.studentId);
      const trainedIds = db.workoutSessions
        .filter((x) => x.finishedAt && x.startedAt.slice(0, 10) === date)
        .map((x) => x.studentId);

      if (inMonth) {
        for (const a of scheduled) {
          const linha = porAluno.get(a.studentId);
          if (a.ocupaHorario) {
            mes.presenciaisPrevistas++;
            if (linha) linha.previstas++;
          }
        }
        for (const id of presentIds) {
          if (byId.get(id)?.modality !== "online") {
            mes.presenciaisRealizadas++;
            const linha = porAluno.get(id);
            if (linha) linha.realizadas++;
          }
        }
        for (const id of absentIds) {
          mes.faltas++;
          const linha = porAluno.get(id);
          if (linha) linha.faltas++;
        }
        for (const id of trainedIds) {
          if (byId.get(id)?.modality === "online") mes.treinosOnline++;
        }
      }

      if (date >= thisWeek && date <= addDays(thisWeek, 6)) {
        for (const a of scheduled) if (a.ocupaHorario) semana.presenciaisPrevistas++;
        for (const id of presentIds) {
          if (byId.get(id)?.modality !== "online") semana.presenciaisRealizadas++;
        }
        semana.faltas += absentIds.length;
        for (const id of trainedIds) {
          if (byId.get(id)?.modality === "online") semana.treinosOnline++;
        }
      }

      return {
        date,
        day: Number(date.slice(8)),
        inMonth,
        isToday: date === today,
        isFuture: date > today,
        scheduled,
        presentIds,
        absentIds,
        trainedIds,
      };
    }),
  );

  return {
    month,
    weeks,
    mes,
    semana,
    porAluno: [...porAluno.values()].filter((l) => l.student.ocupaHorario || l.previstas > 0),
  };
}

/* ------------------------------------------- calendário de frequência do aluno */

export interface StudentDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  scheduled: boolean;
  present: boolean;
  absent: boolean;
  trained: boolean;
  workoutLabel: string | null;
}

export interface StudentAttendance {
  month: string;
  weeks: StudentDay[][];
  ocupaHorario: boolean;
  previstas: number;
  realizadas: number;
  faltas: number;
  extras: number;
  aproveitamento: number;
}

/** Frequência de um aluno num mês: previsto x realizado, dia a dia.
 *  Para presencial e híbrido o que vale é a presença registrada pelo personal;
 *  para o aluno online, a sessão de treino que ele mesmo concluiu. */
export async function buildStudentAttendance(studentId: string, month: string): Promise<StudentAttendance | null> {
  const db = await getDb();
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return null;

  const today = todayISO();
  const ocupaHorario = student.modality !== "online";

  const sessionsByDate = new Map<string, string>();
  for (const s of db.workoutSessions) {
    if (s.studentId !== studentId || !s.finishedAt) continue;
    const date = s.startedAt.slice(0, 10);
    const workout = db.workouts.find((w) => w.id === s.workoutId);
    sessionsByDate.set(date, workout?.label ?? "?");
  }

  let previstas = 0;
  let realizadas = 0;
  let faltas = 0;
  let extras = 0;

  const weeks = monthGrid(month).map((week) =>
    week.map<StudentDay>((date) => {
      const dow = new Date(`${date}T12:00:00`).getDay();
      const inMonth = date.slice(0, 7) === month;
      const scheduled = student.trainingDays.includes(dow) && date >= student.startDate;

      const record = db.attendance.find((a) => a.studentId === studentId && a.date === date);
      const present = record?.present === true;
      const absent = record?.present === false;
      const trained = sessionsByDate.has(date);
      const feito = ocupaHorario ? present || trained : trained;

      if (inMonth) {
        if (scheduled) previstas++;
        if (feito) {
          realizadas++;
          if (!scheduled) extras++; // treinou num dia fora da grade
        }
        if (absent) faltas++;
      }

      return {
        date,
        day: Number(date.slice(8)),
        inMonth,
        isToday: date === today,
        isFuture: date > today,
        scheduled,
        present,
        absent,
        trained,
        workoutLabel: sessionsByDate.get(date) ?? null,
      };
    }),
  );

  return {
    month,
    weeks,
    ocupaHorario,
    previstas,
    realizadas,
    faltas,
    extras,
    aproveitamento: previstas ? Math.round((realizadas / previstas) * 100) : 0,
  };
}
