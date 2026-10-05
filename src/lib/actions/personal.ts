"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gerarSenhaPrimeiroAcesso, hashPassword } from "@/lib/password";
import { assertOwnStudent, requirePersonal } from "@/lib/auth";
import * as repo from "@/lib/repo-write";
import { findUserById } from "@/lib/repo";
import { addDays, todayISO } from "@/lib/dates";
import { faltandoObrigatorios, rotuloCurto } from "@/lib/anamnesis";
import { consumesPackage, formatTime, scheduledTime } from "@/lib/classes";
import { getDb } from "@/lib/scope";
import type { AbsenceReason, Modality, StudentStatus } from "@/lib/types";

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

export interface NovoAlunoState {
  error?: string;
  /** Credenciais para entregar ao aluno. Só existem nesta resposta. */
  acesso?: { studentId: string; nome: string; email: string; senha: string; telefone: string };
}

export async function createStudentAction(
  _prev: NovoAlunoState,
  formData: FormData,
): Promise<NovoAlunoState> {
  const pro = await requirePersonal();
  const name = str(formData.get("name"));
  const email = str(formData.get("email")).toLowerCase();
  if (!name || !email) return { error: "Nome e e-mail são obrigatórios." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "E-mail inválido." };
  if (await repo.emailEmUso(email)) return { error: "Já existe um usuário com este e-mail." };

  /* A senha é gerada aqui, nunca digitada pelo personal. Senha escolhida por
     terceiro tende a virar a mesma para todo mundo — era literalmente o caso
     antes disto, com "aluno123" para o app inteiro. */
  const senha = gerarSenhaPrimeiroAcesso();
  const trainingDays = weekdaysFrom(formData);
  const goal = str(formData.get("goal")) || "Saúde e qualidade de vida";
  const telefone = str(formData.get("phone"));

  let studentId: string;
  try {
    studentId = await repo.insertStudent(pro.id, {
      name,
      email,
      passwordHash: hashPassword(senha),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      birthDate: str(formData.get("birthDate")),
      phone: telefone,
      modality: (str(formData.get("modality")) as Modality) || "online",
      goal,
      trainingDays: trainingDays.length ? trainingDays : [1, 3, 5],
      notes: str(formData.get("notes")),
      planEnd: addDays(todayISO(), 84),
    });
  } catch (e) {
    console.error("createStudentAction", e);
    return { error: "Não foi possível cadastrar agora. Tente de novo em instantes." };
  }

  revalidatePath("/app/alunos");
  // Sem redirect: a senha só existe em texto puro nesta resposta, e a tela
  // precisa mostrá-la uma vez. Depois disto, só o hash fica guardado.
  return { acesso: { studentId, nome: name, email, senha, telefone } };
}

/** Gera outra senha de primeiro acesso. Serve para quando o aluno perde a
 *  primeira — sem isto o personal fica sem saída, porque a senha antiga não
 *  pode ser recuperada, só substituída. */
export async function resetStudentPasswordAction(
  _prev: NovoAlunoState,
  formData: FormData,
): Promise<NovoAlunoState> {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const student = await assertOwnStudent(pro.id, studentId);
  const user = await findUserById(student.userId);
  if (!user) return { error: "Aluno não encontrado." };

  const senha = gerarSenhaPrimeiroAcesso();
  try {
    await repo.resetPrimeiroAcesso(student.userId, hashPassword(senha));
  } catch (e) {
    console.error("resetStudentPasswordAction", e);
    return { error: "Não foi possível gerar agora. Tente de novo em instantes." };
  }

  revalidatePath(`/app/alunos/${studentId}`);
  return {
    acesso: { studentId, nome: user.name, email: user.email, senha, telefone: student.phone },
  };
}

export async function updateStudentAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  await repo.updateStudent(studentId, str(formData.get("name")), {
    modality: str(formData.get("modality")) as Modality,
    goal: str(formData.get("goal")),
    phone: str(formData.get("phone")),
    birthDate: str(formData.get("birthDate")),
    status: (str(formData.get("status")) as StudentStatus) || "ativo",
    notes: str(formData.get("notes")),
    trainingDays: weekdaysFrom(formData),
  });

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/alunos");
}

/* ------------------------------------------------------------- exercícios */

export async function saveExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const name = str(formData.get("name"));
  if (!name) throw new Error("Informe o nome do exercício.");

  await repo.upsertExercise(pro.id, str(formData.get("exerciseId")) || null, {
    name,
    muscleGroup: str(formData.get("muscleGroup")),
    equipment: str(formData.get("equipment")),
    videoUrl: str(formData.get("videoUrl")),
    instructions: str(formData.get("instructions")),
    commonMistakes: str(formData.get("commonMistakes")),
    tips: str(formData.get("tips")),
  });

  revalidatePath("/app/exercicios");
}

export async function deleteExerciseAction(formData: FormData) {
  await requirePersonal();
  await repo.deleteExercise(str(formData.get("exerciseId")));
  revalidatePath("/app/exercicios");
}

/* ----------------------------------------------------------------- treinos */

export async function createWorkoutAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  const planId = await repo.ensureActivePlan(studentId, pro.id, addDays(todayISO(), 84));
  await repo.insertWorkout(planId, {
    label: str(formData.get("label")),
    name: str(formData.get("name")) || "Novo treino",
    weekdays: weekdaysFrom(formData),
    estimatedMinutes: num(formData.get("estimatedMinutes")) ?? 50,
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function deleteWorkoutAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);
  await repo.deleteWorkout(str(formData.get("workoutId")));
  revalidatePath(`/app/alunos/${studentId}`);
}

export async function addWorkoutExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const exerciseId = str(formData.get("exerciseId"));
  await assertOwnStudent(pro.id, studentId);
  if (!exerciseId) throw new Error("Selecione um exercício.");

  await repo.insertWorkoutExercise(str(formData.get("workoutId")), exerciseId, {
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

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function updateWorkoutExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  await repo.updateWorkoutExercise(str(formData.get("itemId")), {
    sets: num(formData.get("sets")) ?? undefined,
    repsMin: num(formData.get("repsMin")) ?? undefined,
    repsMax: num(formData.get("repsMax")) ?? undefined,
    load: num(formData.get("load")) ?? undefined,
    restSeconds: num(formData.get("restSeconds")) ?? undefined,
    rir: num(formData.get("rir")) ?? undefined,
    notes: str(formData.get("notes")),
  });

  revalidatePath(`/app/alunos/${studentId}`);
}

export async function removeWorkoutExerciseAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);
  await repo.deleteWorkoutExercise(str(formData.get("itemId")));
  revalidatePath(`/app/alunos/${studentId}`);
}

/* -------------------------------------------------------------- avaliações */

export async function createAssessmentAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  await repo.insertAssessment({
    studentId,
    professionalId: pro.id,
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

  revalidatePath(`/app/alunos/${studentId}`);
}

/* ---------------------------------------------------------------- check-in */

export async function replyCheckinAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const student = await assertOwnStudent(pro.id, studentId);

  await repo.replyCheckin(str(formData.get("checkinId")), student.userId, str(formData.get("coachReply")));

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/checkins");
}

/* -------------------------------------------------------------- presencial */

const MOTIVOS: AbsenceReason[] = ["falta_aluno", "cancelada", "remarcada"];

/** Resposta do personal à pergunta "houve a aula?".
 *
 * `present=1` grava a aula realizada. `present=0` exige o motivo, porque é o
 * motivo que decide se a aula sai do pacote: falta do aluno sai (o horário foi
 * reservado e perdido), cancelamento e remarcação não saem. */
export async function markAttendanceAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  const date = str(formData.get("date")) || todayISO();
  const present = str(formData.get("present")) === "1";

  const motivo = str(formData.get("reason")) as AbsenceReason;
  const reason: AbsenceReason = present ? "" : MOTIVOS.includes(motivo) ? motivo : "falta_aluno";

  const db = await getDb();
  const startTime = scheduledTime(db.classSchedule, studentId, date);

  await repo.markAttendance(studentId, pro.id, date, {
    present,
    reason,
    consumes: consumesPackage(present, reason),
    startTime,
  });

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  revalidatePath("/aluno");
  revalidatePath("/aluno/agenda");
}

/* ------------------------------------------- horário das aulas e pacote mensal */

/** Grava a grade de horários do aluno e o tamanho do pacote.
 *
 * Só aceita horário para dia que está na grade de treino: horário num dia que
 * o aluno não treina geraria uma cobrança de confirmação que nunca deveria
 * existir. Dia marcado sem hora continua valendo — aparece na agenda, só não
 * dispara a pergunta automática. */
export async function saveClassScheduleAction(formData: FormData) {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  const student = await assertOwnStudent(pro.id, studentId);

  const duracao = Math.min(300, Math.max(15, Number(str(formData.get("durationMin"))) || 60));
  const pacote = Math.min(99, Math.max(0, Number(str(formData.get("monthlyClasses"))) || 0));

  const horarios = student.trainingDays
    .map((weekday) => ({
      weekday,
      startTime: str(formData.get(`time_${weekday}`)),
      durationMin: duracao,
    }))
    .filter((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h.startTime));

  await repo.saveClassSchedule(studentId, pro.id, horarios, pacote);

  revalidatePath(`/app/alunos/${studentId}`);
  revalidatePath("/app/agenda");
  revalidatePath("/aluno");
  revalidatePath("/aluno/agenda");
}

/* --------------------------------------------------------------- anamnese */

/* ---------------------------------------------------------- metas de hábito */

export interface HabitTargetsState {
  ok?: string;
  error?: string;
}

export async function saveHabitTargetsAction(
  _prev: HabitTargetsState,
  formData: FormData,
): Promise<HabitTargetsState> {
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  // O personal digita em litros porque é como se fala; o banco guarda em
  // mililitros para não acumular erro de arredondamento.
  const litros = num(formData.get("waterLiters"));
  if (litros !== null && (litros < 0 || litros > 20)) {
    return { error: "Meta de água fora do razoável. Use um valor entre 0 e 20 litros." };
  }

  try {
    await repo.saveHabitTargets(studentId, pro.id, {
      waterMl: litros === null ? 0 : Math.round(litros * 1000),
      nutrition: str(formData.get("nutrition")),
      supplement: str(formData.get("supplement")),
    });
    revalidatePath(`/app/alunos/${studentId}`);
    revalidatePath("/aluno/habitos");
    return { ok: "Metas salvas. O aluno já vê na aba de hábitos." };
  } catch (e) {
    console.error("saveHabitTargetsAction", e);
    return { error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
}

export interface AnamnesisState {
  ok?: string;
  error?: string;
  /** Obrigatórios ainda vazios. Avisa, mas não impede o personal de salvar. */
  aviso?: string;
}

export async function saveAnamnesisAction(
  _prev: AnamnesisState,
  formData: FormData,
): Promise<AnamnesisState> {
  // Fora do try: requirePersonal redireciona lançando, e engolir isso mostraria
  // "erro ao salvar" para quem apenas está com a sessão vencida.
  const pro = await requirePersonal();
  const studentId = str(formData.get("studentId"));
  await assertOwnStudent(pro.id, studentId);

  const answers: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    // studentId é controle do formulário; os $... são campos internos do Next.
    if (k === "studentId" || k.startsWith("$")) continue;
    answers[k] = String(v);
  }

  try {
    await repo.saveAnamnesis(studentId, pro.id, answers);
    revalidatePath(`/app/alunos/${studentId}`);

    /* Do lado do aluno o campo obrigatório vazio barra o envio. Aqui não:
       travar o personal por uma pergunta que o aluno não respondeu seria
       impedi-lo de anotar o que acabou de ouvir em consulta. Avisa e salva. */
    const faltando = faltandoObrigatorios(answers);
    return faltando.length === 0
      ? { ok: "Anamnese salva." }
      : {
          ok: "Anamnese salva.",
          aviso: `Ainda falta preencher: ${faltando.map(rotuloCurto).join(", ")}.`,
        };
  } catch (e) {
    console.error("saveAnamnesisAction", e);
    return { error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
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
  if (await repo.emailEmUso(email, pro.id)) {
    return { error: "Este e-mail já está em uso por outro usuário." };
  }

  let novoHash: string | undefined;
  if (newPassword || confirmPassword) {
    const atual = await findUserById(pro.id);
    if (!atual || hashPassword(currentPassword) !== atual.passwordHash) {
      return { error: "Senha atual incorreta." };
    }
    if (newPassword.length < 6) return { error: "A nova senha precisa ter ao menos 6 caracteres." };
    if (newPassword !== confirmPassword) return { error: "A confirmação não confere com a nova senha." };
    novoHash = hashPassword(newPassword);
  }

  await repo.updateAccount(pro.id, name, email, novoHash);

  revalidatePath("/app");
  revalidatePath("/app/conta");
  return { ok: novoHash ? "Conta e senha atualizadas." : "Conta atualizada." };
}

/* ------------------------------------------------------------------ avisos */

export async function markPersonalNotificationsReadAction() {
  const pro = await requirePersonal();
  await repo.markNotificationsRead(pro.id);
  revalidatePath("/app/avisos");
  revalidatePath("/app");
}

export async function clearPersonalNotificationsAction() {
  const pro = await requirePersonal();
  await repo.clearNotifications(pro.id);
  revalidatePath("/app/avisos");
  revalidatePath("/app");
}
