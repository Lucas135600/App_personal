"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { putPhoto } from "@/lib/storage";
import { requireStudent } from "@/lib/auth";
import * as repo from "@/lib/repo-write";
import { currentMonth, currentWeekStart, todayISO } from "@/lib/dates";
import { faltandoObrigatorios, rotuloCurto } from "@/lib/anamnesis";
import { estadoConsentimento, VERSAO_TERMO } from "@/lib/consent";
import { getDb } from "@/lib/scope";
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
  const { user, student } = await requireStudent();
  const workoutId = str(formData.get("workoutId"));
  const rpeRaw = str(formData.get("rpe"));

  let sets: LoggedSet[] = [];
  try {
    sets = JSON.parse(str(formData.get("sets")) || "[]") as LoggedSet[];
  } catch {
    sets = [];
  }

  await repo.insertSession({
    studentId: student.id,
    professionalId: student.professionalId,
    studentName: user.name,
    workoutId,
    startedAt: str(formData.get("startedAt")) || new Date().toISOString(),
    rpe: rpeRaw ? Number(rpeRaw) : null,
    notes: str(formData.get("notes")),
    sets,
    registraPresenca: student.modality !== "online",
  });

  revalidatePath("/aluno");
  revalidatePath("/aluno/treinos");
  revalidatePath("/app");
  revalidatePath("/app/avisos");
  redirect(`/aluno/treinos/${workoutId}/concluido`);
}

/* ------------------------------------------------------------------ check-in */

export async function submitCheckinAction(formData: FormData) {
  const { user, student } = await requireStudent();
  const weekStart = str(formData.get("weekStart")) || currentWeekStart();
  const weightRaw = str(formData.get("weight"));

  await repo.answerCheckin({
    studentId: student.id,
    professionalId: student.professionalId,
    studentName: user.name,
    weekStart,
    answers: {
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
    },
  });

  revalidatePath("/aluno");
  revalidatePath("/aluno/checkin");
  revalidatePath("/app");
  revalidatePath("/app/checkins");
  revalidatePath("/app/avisos");
}

/** Garante que o check-in da semana existe antes de a tela montar o formulário. */
export async function ensureCurrentCheckinAction() {
  const { student } = await requireStudent();
  await repo.ensureCheckin(student.id, student.professionalId, currentWeekStart());
}

/* -------------------------------------------------------------------- hábitos */

export async function toggleHabitAction(formData: FormData) {
  const { student } = await requireStudent();
  await repo.cycleHabit(
    student.id,
    str(formData.get("date")) || todayISO(),
    str(formData.get("field")) as repo.CampoHabito,
  );
  revalidatePath("/aluno/habitos");
  revalidatePath("/aluno");
}

/* --------------------------------------------------------- fotos de evolução */

const ALLOWED_IMAGE = /^image\/(jpeg|png|webp)$/;

export async function uploadProgressPhotoAction(formData: FormData) {
  const { user, student } = await requireStudent();
  const angle = str(formData.get("angle")) as PhotoAngle;
  const month = str(formData.get("month")) || currentMonth();
  const file = formData.get("photo");

  /* A tela já esconde o campo sem autorização, mas esconder não é impedir:
     um envio montado à mão chegaria aqui do mesmo jeito. */
  const db = await getDb();
  if (!estadoConsentimento(db, student.id).imagem) {
    throw new Error("Envio de foto não autorizado. Ajuste a autorização no seu perfil.");
  }

  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  if (!ALLOWED_IMAGE.test(file.type)) throw new Error("Use uma imagem JPEG, PNG ou WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem acima de 15 MB.");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const fileName = `${student.id}_${month}_${angle}_${Date.now()}.${ext}`;
  await putPhoto(fileName, Buffer.from(await file.arrayBuffer()), file.type);

  await repo.upsertPhoto({
    studentId: student.id,
    professionalId: student.professionalId,
    studentName: user.name,
    month,
    angle,
    fileName,
  });

  revalidatePath("/aluno/evolucao");
  revalidatePath("/aluno");
  revalidatePath("/app/avisos");
}

/* -------------------------------------------------------------------- anamnese */

export interface AnamnesisState {
  ok?: string;
  error?: string;
  /** Chaves obrigatórias que vieram vazias, para a tela levar o aluno até elas. */
  faltando?: string[];
}

export async function saveStudentAnamnesisAction(
  _prev: AnamnesisState,
  formData: FormData,
): Promise<AnamnesisState> {
  // Fora do try de propósito: requireStudent redireciona lançando, e um catch
  // aqui engoliria o redirecionamento e mostraria "erro ao salvar" para quem
  // só está com a sessão vencida.
  const { user, student } = await requireStudent();

  const answers: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    // O Next injeta campos internos ($ACTION_ID_...) no formulário; eles não
    // são resposta de ninguém e não têm o que fazer dentro da anamnese.
    if (k.startsWith("$")) continue;
    answers[k] = String(v);
  }

  /* A obrigatoriedade é conferida aqui, no servidor, e não pelo `required` do
     HTML. O assistente mantém as etapas ocultas dentro do mesmo formulário, e
     o navegador se recusa a validar um campo que não consegue rolar até a
     tela: ele cancelaria o envio em silêncio, que é exatamente o problema que
     esta tela acabou de deixar de ter. */
  const faltando = faltandoObrigatorios(answers);
  if (faltando.length > 0) {
    const nomes = faltando.map(rotuloCurto).join(", ");
    return {
      faltando,
      error:
        faltando.length === 1
          ? `Falta responder: ${nomes}. Sem isso não dá para montar um treino seguro.`
          : `Faltam ${faltando.length} respostas obrigatórias: ${nomes}.`,
    };
  }

  try {
    const primeira = await repo.saveAnamnesis(student.id, student.professionalId, answers);
    await repo.notify(
      student.professionalId,
      primeira ? "Anamnese respondida" : "Anamnese atualizada",
      `${user.name} ${primeira ? "preencheu" : "revisou"} a anamnese.`,
      `/app/alunos/${student.id}?tab=anamnese`,
    );

    revalidatePath("/aluno/anamnese");
    revalidatePath("/aluno");
    revalidatePath("/app/avisos");

    return {
      ok: primeira
        ? "Anamnese enviada. Seu personal já foi avisado."
        : "Alterações salvas.",
    };
  } catch (e) {
    // Sem isto a tela fica parada e o aluno não sabe se salvou ou não.
    console.error("saveStudentAnamnesisAction", e);
    return { error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
}

/* -------------------------------------------------------- consentimento LGPD */

export interface ConsentState {
  error?: string;
  ok?: string;
}

/** Primeira decisão, na tela que bloqueia o acesso até ser respondida. */
export async function grantConsentAction(
  _prev: ConsentState,
  formData: FormData,
): Promise<ConsentState> {
  const { student } = await requireStudent();

  // Sem a base legal para tratar dado de saúde não há serviço a prestar.
  if (formData.get("dados") !== "on") {
    return { error: "Para usar o aplicativo é preciso autorizar o tratamento dos dados de saúde." };
  }

  // A de imagem é separada e opcional de propósito: consentimento exigido como
  // condição de uso não é livre, e sem liberdade não vale como consentimento.
  const imagem = formData.get("imagem") === "on";

  try {
    await repo.recordConsent(student.id, "dados", true, VERSAO_TERMO);
    await repo.recordConsent(student.id, "imagem", imagem, VERSAO_TERMO);
  } catch (e) {
    console.error("grantConsentAction", e);
    return { error: "Não foi possível registrar agora. Tente de novo em instantes." };
  }

  revalidatePath("/aluno", "layout");
  redirect("/aluno");
}

/** Liga e desliga a autorização de imagem pelo perfil, a qualquer momento. */
export async function toggleImageConsentAction(formData: FormData) {
  const { student } = await requireStudent();
  const autorizar = str(formData.get("autorizar")) === "sim";
  await repo.recordConsent(student.id, "imagem", autorizar, VERSAO_TERMO);
  revalidatePath("/aluno/perfil");
  revalidatePath("/aluno/evolucao");
}

/* ---------------------------------------------------------------- notificações */

export async function markNotificationsReadAction() {
  const { user } = await requireStudent();
  await repo.markNotificationsRead(user.id);
  revalidatePath("/aluno");
}
