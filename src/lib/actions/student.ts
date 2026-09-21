"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { id, mutate, saveUpload } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { currentMonth, currentWeekStart, todayISO } from "@/lib/dates";
import { ensureCurrentCheckin } from "@/lib/queries";
import type { PhotoAngle } from "@/lib/types";

interface LoggedSet {
  workoutExerciseId: string;
  setNumber: number;
  load: number;
  reps: number;
  rpe: number | null;
}

function str(v: FormDataEntryValue | null) {
  return String(v ?? "").trim();
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/* --------------------------------------------------------- execução do treino */

export async function finishWorkoutAction(formData: FormData) {
  const { student } = await requireStudent();
  const workoutId = str(formData.get("workoutId"));
  const startedAt = str(formData.get("startedAt")) || new Date().toISOString();
  const rpeRaw = str(formData.get("rpe"));
  const notes = str(formData.get("notes"));

  let sets: LoggedSet[] = [];
  try {
    sets = JSON.parse(str(formData.get("sets")) || "[]") as LoggedSet[];
  } catch {
    sets = [];
  }

  const sessionId = id("ses");
  mutate((d) => {
    d.workoutSessions.push({
      id: sessionId,
      studentId: student.id,
      workoutId,
      startedAt,
      finishedAt: new Date().toISOString(),
      rpe: rpeRaw ? Number(rpeRaw) : null,
      notes,
    });
    for (const s of sets) {
      d.workoutSets.push({
        id: id("set"),
        sessionId,
        workoutExerciseId: s.workoutExerciseId,
        setNumber: s.setNumber,
        load: s.load,
        reps: s.reps,
        rpe: s.rpe,
        doneAt: new Date().toISOString(),
      });
      // A carga usada vira a referência da próxima sessão.
      const we = d.workoutExercises.find((x) => x.id === s.workoutExerciseId);
      if (we && s.load > 0) we.load = s.load;
    }
    if (student.modality !== "online") {
      const date = todayISO();
      const found = d.attendance.find((a) => a.studentId === student.id && a.date === date);
      if (found) found.present = true;
      else
        d.attendance.push({
          id: id("att"), studentId: student.id, professionalId: student.professionalId,
          date, present: true, notes: "",
        });
    }
    d.notifications.push({
      id: id("ntf"), userId: student.professionalId,
      title: "Treino concluído",
      body: `${d.users.find((u) => u.id === student.userId)?.name ?? "Aluno"} finalizou o treino de hoje.`,
      link: `/app/alunos/${student.id}`, read: false, createdAt: todayISO(),
    });
  });

  revalidatePath("/aluno");
  revalidatePath("/aluno/treinos");
  revalidatePath("/app");
  revalidatePath("/app/avisos");
  redirect(`/aluno/treinos/${workoutId}/concluido`);
}

/* ------------------------------------------------------------------ check-in */

export async function submitCheckinAction(formData: FormData) {
  const { student } = await requireStudent();
  const weekStart = str(formData.get("weekStart")) || currentWeekStart();

  mutate((d) => {
    ensureCurrentCheckin(student.id, student.professionalId, d);
    const c = d.checkins.find((x) => x.studentId === student.id && x.weekStart === weekStart);
    if (!c) return;
    const weightRaw = str(formData.get("weight"));
    c.status = "respondido";
    c.answeredAt = todayISO();
    c.answers = {
      week: 0,
      workoutsDone: num(formData.get("workoutsDone")),
      energy: num(formData.get("energy")),
      sleep: num(formData.get("sleep")),
      nutrition: num(formData.get("nutrition")),
      motivation: num(formData.get("motivation")),
      pain: str(formData.get("pain")) === "sim",
      painNotes: str(formData.get("painNotes")),
      weight: weightRaw ? num(formData.get("weight")) : null,
      notes: str(formData.get("notes")),
    };
    d.notifications.push({
      id: id("ntf"), userId: student.professionalId,
      title: "Check-in respondido",
      body: `${d.users.find((u) => u.id === student.userId)?.name ?? "Aluno"} enviou o check-in da semana.`,
      link: `/app/alunos/${student.id}?tab=checkins`, read: false, createdAt: todayISO(),
    });
  });

  revalidatePath("/aluno");
  revalidatePath("/aluno/checkin");
  revalidatePath("/app");
  revalidatePath("/app/checkins");
  revalidatePath("/app/avisos");
}

/* -------------------------------------------------------------------- hábitos */

export async function toggleHabitAction(formData: FormData) {
  const { student } = await requireStudent();
  const date = str(formData.get("date")) || todayISO();
  const field = str(formData.get("field")) as "water" | "nutrition" | "sleep" | "steps" | "supplement";

  mutate((d) => {
    let log = d.habitLogs.find((h) => h.studentId === student.id && h.date === date);
    if (!log) {
      log = {
        id: id("hab"), studentId: student.id, date,
        water: false, nutrition: false, sleep: false, steps: false, supplement: false, notes: "",
      };
      d.habitLogs.push(log);
    }
    log[field] = !log[field];
  });

  revalidatePath("/aluno/habitos");
  revalidatePath("/aluno");
}

/* --------------------------------------------------------- fotos de evolução */

const ALLOWED_IMAGE = /^image\/(jpeg|png|webp)$/;

export async function uploadProgressPhotoAction(formData: FormData) {
  const { student } = await requireStudent();
  const angle = str(formData.get("angle")) as PhotoAngle;
  const month = str(formData.get("month")) || currentMonth();
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  if (!ALLOWED_IMAGE.test(file.type)) throw new Error("Use uma imagem JPEG, PNG ou WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem acima de 15 MB.");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const fileName = `${student.id}_${month}_${angle}_${Date.now()}.${ext}`;
  saveUpload(fileName, Buffer.from(await file.arrayBuffer()));

  mutate((d) => {
    d.progressPhotos = d.progressPhotos.filter(
      (p) => !(p.studentId === student.id && p.month === month && p.angle === angle),
    );
    d.progressPhotos.push({
      id: id("pht"), studentId: student.id, month, angle, fileName,
      createdAt: new Date().toISOString(),
    });
    d.notifications.push({
      id: id("ntf"), userId: student.professionalId,
      title: "Nova foto de evolução",
      body: `${d.users.find((u) => u.id === student.userId)?.name ?? "Aluno"} registrou a foto de ${angle}.`,
      link: `/app/alunos/${student.id}?tab=evolucao`, read: false, createdAt: todayISO(),
    });
  });

  revalidatePath("/app/avisos");
  revalidatePath("/aluno/evolucao");
  revalidatePath("/aluno");
}

/* -------------------------------------------------------------------- anamnese */

export async function saveStudentAnamnesisAction(formData: FormData) {
  const { student } = await requireStudent();

  mutate((d) => {
    let a = d.anamnesis.find((x) => x.studentId === student.id);
    if (!a) {
      a = {
        id: id("anm"), studentId: student.id, professionalId: student.professionalId,
        answeredAt: null, answers: {},
      };
      d.anamnesis.push(a);
    }
    const first = !a.answeredAt;
    for (const [k, v] of formData.entries()) a.answers[k] = String(v);
    a.answeredAt = todayISO();
    d.notifications.push({
      id: id("ntf"), userId: student.professionalId,
      title: first ? "Anamnese respondida" : "Anamnese atualizada",
      body: `${d.users.find((u) => u.id === student.userId)?.name ?? "Aluno"} ${first ? "preencheu" : "revisou"} a anamnese.`,
      link: `/app/alunos/${student.id}?tab=anamnese`, read: false, createdAt: todayISO(),
    });
  });

  revalidatePath("/app/avisos");
  revalidatePath("/aluno/anamnese");
  revalidatePath("/aluno");
}

/* ---------------------------------------------------------------- notificações */

export async function markNotificationsReadAction() {
  const { user } = await requireStudent();
  mutate((d) => {
    for (const n of d.notifications) if (n.userId === user.id) n.read = true;
  });
  revalidatePath("/aluno");
}
