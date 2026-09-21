"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, hashPassword, id, mutate } from "@/lib/db";
import { assertOwnStudent, requirePersonal } from "@/lib/auth";
import { ensureCurrentCheckin } from "@/lib/queries";
import { addDays, todayISO } from "@/lib/dates";
import type { Modality, StudentStatus } from "@/lib/types";

const COLORS = ["#4ade80", "#f472b6", "#fb923c", "#38bdf8", "#a78bfa", "#fbbf24", "#2dd4bf", "#f9a8d4"];

function num(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function weekdaysFrom(formData: FormData): number[] {
  return formData
    .getAll("weekdays")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort();
}

/* ------------------------------------------------------------------ alunos */

export async function createStudentAction(formData: FormData) {
  const pro = await requirePersonal();
  const name = str(formData.get("name"));
  const email = str(formData.get("email")).toLowerCase();
  if (!name || !email) throw new Error("Nome e e-mail são obrigatorios.");

  const db = getDb();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("Já existe um usuário com este e-mail.");
  }

  const password = str(formData.get("password")) || "aluno123";
  const userId = id("usr");
  const studentId = id("std");
  const trainingDays = weekdaysFrom(formData);

  mutate((d) => {
    d.users.push({
      id: userId,
      email,
      passwordHash: hashPassword(password),
      name,
      role: "student",
      professionalId: pro.id,
      avatarColor: COLORS[d.users.length % COLORS.length],
      createdAt: todayISO(),
    });
    d.students.push({
      id: studentId,
      userId,
      professionalId: pro.id,
      birthDate: str(formData.get("birthDate")) || "1990-01-01",
      phone: str(formData.get("phone")),
      modality: (str(formData.get("modality")) as Modality) || "online",
      goal: str(formData.get("goal")) || "Saúde e qualidade de vida",
      status: "ativo",
      startDate: todayISO(),
      trainingDays: trainingDays.length ? trainingDays : [1, 3, 5],
      notes: str(formData.get("notes")),
    });
    d.anamnesis.push({
      id: id("anm"), studentId, professionalId: pro.id, answeredAt: null, answers: {},
    });
    d.trainingPlans.push({
      id: id("plan"), studentId, professionalId: pro.id,
      name: "Bloco inicial", goal: str(formData.get("goal")) || "Saúde e qualidade de vida",
      startDate: todayISO(), endDate: addDays(todayISO(), 84), active: true,
    });
    ensureCurrentCheckin(studentId, pro.id, d);
    d.notifications.push({
      id: id("ntf"), userId, title: "Bem-vindo a LB Personal Trainner",
      body: "Comece respondendo sua anamnese para o Lucas montar seu treino.",
      link: "/aluno/anamnese", read: false, createdAt: todayISO(),
    });
  });

  revalidatePath("/app/alunos");
  redirect(`/app/alunos/${studentId}`);
}

export async function updateStudentAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  assertOwnStudent(pro.id, studentId);
  const trainingDays = weekdaysFrom(formData);

  mutate((d) => {
    const s = d.students.find((x) => x.id === studentId)!;
    s.modality = (str(formData.get("modality")) as Modality) || s.modality;
    s.goal = str(formData.get("goal")) || s.goal;
    s.phone = str(formData.get("phone"));
    s.birthDate = str(formData.get("birthDate")) || s.birthDate;
    s.status = (str(formData.get("status")) as StudentStatus) || s.status;
    s.notes = str(formData.get("notes"));
    if (trainingDays.length) s.trainingDays = trainingDays;

    const u = d.users.find((x) => x.id === s.userId)!;
    u.name = str(formData.get("name")) || u.name;
  });

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/alunos");
}

/* ------------------------------------------------------------- exercícios */

export async function saveExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const exerciseId = str(formData.get("exerciseId"));
  const payload = {
    name: str(formData.get("name")),
    muscleGroup: str(formData.get("muscleGroup")),
    equipment: str(formData.get("equipment")),
    videoUrl: str(formData.get("videoUrl")),
    instructions: str(formData.get("instructions")),
    commonMistakes: str(formData.get("commonMistakes")),
    tips: str(formData.get("tips")),
  };
  if (!payload.name) throw new Error("Informe o nome do exercício.");

  mutate((d) => {
    if (exerciseId) {
      const ex = d.exercises.find((e) => e.id === exerciseId);
      if (ex) Object.assign(ex, payload);
    } else {
      d.exercises.push({ id: id("ex"), professionalId: pro.id, ...payload });
    }
  });

  revalidatePath("/app/exercicios");
}

export async function deleteExerciseAction(formData: FormData) {
  await requirePersonal();
  const exerciseId = str(formData.get("exerciseId"));
  mutate((d) => {
    const inUse = d.workoutExercises.some((we) => we.exerciseId === exerciseId);
    if (inUse) throw new Error("Exercício em uso em algum treino.");
    d.exercises = d.exercises.filter((e) => e.id !== exerciseId);
  });
  revalidatePath("/app/exercicios");
}

/* ----------------------------------------------------------------- treinos */

export async function createWorkoutAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    let plan = d.trainingPlans.find((p) => p.studentId === studentId && p.active);
    if (!plan) {
      plan = {
        id: id("plan"), studentId, professionalId: pro.id, name: "Bloco atual",
        goal: "", startDate: todayISO(), endDate: addDays(todayISO(), 84), active: true,
      };
      d.trainingPlans.push(plan);
    }
    const siblings = d.workouts.filter((w) => w.planId === plan!.id);
    d.workouts.push({
      id: id("wk"),
      planId: plan.id,
      label: str(formData.get("label")) || String.fromCharCode(65 + siblings.length),
      name: str(formData.get("name")) || "Novo treino",
      weekdays: weekdaysFrom(formData),
      orderIndex: siblings.length,
      estimatedMinutes: num(formData.get("estimatedMinutes")) ?? 50,
    });
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function deleteWorkoutAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const workoutId = str(formData.get("workoutId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    const items = d.workoutExercises.filter((we) => we.workoutId === workoutId).map((we) => we.id);
    d.workoutExercises = d.workoutExercises.filter((we) => we.workoutId !== workoutId);
    d.workoutSets = d.workoutSets.filter((s) => !items.includes(s.workoutExerciseId));
    d.workoutSessions = d.workoutSessions.filter((s) => s.workoutId !== workoutId);
    d.workouts = d.workouts.filter((w) => w.id !== workoutId);
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function addWorkoutExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const workoutId = str(formData.get("workoutId"));
  const exerciseId = str(formData.get("exerciseId"));
  assertOwnStudent(pro.id, studentId);
  if (!exerciseId) throw new Error("Selecione um exercício.");

  mutate((d) => {
    const siblings = d.workoutExercises.filter((we) => we.workoutId === workoutId);
    d.workoutExercises.push({
      id: id("we"), workoutId, exerciseId, orderIndex: siblings.length,
      sets: num(formData.get("sets")) ?? 3,
      repsMin: num(formData.get("repsMin")) ?? 8,
      repsMax: num(formData.get("repsMax")) ?? 12,
      load: num(formData.get("load")) ?? 0,
      restSeconds: num(formData.get("restSeconds")) ?? 60,
      rir: num(formData.get("rir")) ?? 2,
      cadence: str(formData.get("cadence")) || "3-0-1",
      method: str(formData.get("method")),
      notes: str(formData.get("notes")),
    });
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function updateWorkoutExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const itemId = str(formData.get("itemId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    const we = d.workoutExercises.find((x) => x.id === itemId);
    if (!we) return;
    we.sets = num(formData.get("sets")) ?? we.sets;
    we.repsMin = num(formData.get("repsMin")) ?? we.repsMin;
    we.repsMax = num(formData.get("repsMax")) ?? we.repsMax;
    we.load = num(formData.get("load")) ?? we.load;
    we.restSeconds = num(formData.get("restSeconds")) ?? we.restSeconds;
    we.rir = num(formData.get("rir")) ?? we.rir;
    we.notes = str(formData.get("notes"));
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function removeWorkoutExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const itemId = str(formData.get("itemId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    d.workoutExercises = d.workoutExercises.filter((we) => we.id !== itemId);
    d.workoutSets = d.workoutSets.filter((s) => s.workoutExerciseId !== itemId);
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

/* -------------------------------------------------------------- avaliações */

export async function createAssessmentAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    d.assessments.push({
      id: id("asm"), studentId, professionalId: pro.id,
      date: str(formData.get("date")) || todayISO(),
      weight: num(formData.get("weight")),
      height: num(formData.get("height")),
      bodyFat: num(formData.get("bodyFat")),
      muscleMass: num(formData.get("muscleMass")),
      measurements: {
        cintura: num(formData.get("cintura")),
        abdomen: num(formData.get("abdomen")),
        quadril: num(formData.get("quadril")),
        bracoD: num(formData.get("bracoD")),
        coxaD: num(formData.get("coxaD")),
        peitoral: num(formData.get("peitoral")),
      },
      notes: str(formData.get("notes")),
    });
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

/* ---------------------------------------------------------------- check-in */

export async function replyCheckinAction(formData: FormData) {
  const pro = await requirePersonal();
  const checkinId = str(formData.get("checkinId"));
  const studentId = str(formData.get("studentId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    const c = d.checkins.find((x) => x.id === checkinId);
    if (!c) return;
    c.coachReply = str(formData.get("coachReply"));
    const st = d.students.find((s) => s.id === studentId)!;
    d.notifications.push({
      id: id("ntf"), userId: st.userId,
      title: "Seu personal respondeu seu check-in",
      body: c.coachReply.slice(0, 120),
      link: "/aluno/checkin", read: false, createdAt: todayISO(),
    });
  });

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/checkins");
}

/* -------------------------------------------------------------- presencial */

export async function markAttendanceAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const date = str(formData.get("date")) || todayISO();
  const present = str(formData.get("present")) === "1";
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    const found = d.attendance.find((a) => a.studentId === studentId && a.date === date);
    if (found) found.present = present;
    else d.attendance.push({ id: id("att"), studentId, professionalId: pro.id, date, present, notes: "" });
  });

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/agenda");
  revalidatePath("/app");
}

/* --------------------------------------------------------------- anamnese */

export async function saveAnamnesisAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  assertOwnStudent(pro.id, studentId);

  mutate((d) => {
    let a = d.anamnesis.find((x) => x.studentId === studentId);
    if (!a) {
      a = { id: id("anm"), studentId, professionalId: pro.id, answeredAt: null, answers: {} };
      d.anamnesis.push(a);
    }
    for (const [k, v] of formData.entries()) {
      if (k === "studentId") continue;
      a.answers[k] = String(v);
    }
    a.answeredAt = todayISO();
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

/* ------------------------------------------------------------- minha conta */

export interface AccountState {
  error?: string;
  ok?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function updateAccountAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const pro = await requirePersonal();

  const name = str(formData.get("name"));
  const email = str(formData.get("email")).toLowerCase();
  const currentPassword = str(formData.get("currentPassword"));
  const newPassword = str(formData.get("newPassword"));
  const confirmPassword = str(formData.get("confirmPassword"));

  if (!name) return { error: "Informe seu nome." };
  if (!EMAIL_RE.test(email)) return { error: "E-mail inválido." };

  const db = getDb();
  const taken = db.users.some((u) => u.id !== pro.id && u.email.toLowerCase() === email);
  if (taken) return { error: "Este e-mail já está em uso por outro usuário." };

  if (newPassword || confirmPassword) {
    if (hashPassword(currentPassword) !== pro.passwordHash) {
      return { error: "Senha atual incorreta." };
    }
    if (newPassword.length < 6) return { error: "A nova senha precisa ter ao menos 6 caracteres." };
    if (newPassword !== confirmPassword) return { error: "A confirmação não confere com a nova senha." };
  }

  mutate((d) => {
    const u = d.users.find((x) => x.id === pro.id)!;
    u.name = name;
    u.email = email;
    if (newPassword) u.passwordHash = hashPassword(newPassword);
  });

  revalidatePath("/app");
  revalidatePath("/app/conta");
  return { ok: newPassword ? "Conta e senha atualizadas." : "Conta atualizada." };
}

/* ------------------------------------------------------------------ avisos */

export async function markPersonalNotificationsReadAction() {
  const pro = await requirePersonal();
  mutate((d) => {
    for (const n of d.notifications) if (n.userId === pro.id) n.read = true;
  });
  revalidatePath("/app/avisos");
  revalidatePath("/app");
}

export async function clearPersonalNotificationsAction() {
  const pro = await requirePersonal();
  mutate((d) => {
    d.notifications = d.notifications.filter((n) => n.userId !== pro.id);
  });
  revalidatePath("/app/avisos");
  revalidatePath("/app");
}
