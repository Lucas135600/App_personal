import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";
import { findStudentByUserId, findUserById, loadProfessionalData } from "./repo";
import type { Database } from "./types";

/* getDb() devolve o mesmo formato que as telas sempre usaram, mas carregado do
 * Postgres e limitado ao profissional da sessão. Duas consequências:
 *
 * 1. Isolamento: ninguém carrega linha de outro profissional, nem por engano.
 * 2. Uma carga por requisição, não por chamada — o cache() do React garante
 *    isso mesmo quando a página chama getDb() em cinco lugares diferentes.
 */

/** Profissional dono dos dados desta requisição: o próprio, se for o personal;
 *  o personal do aluno, se for aluno. */
const currentProfessionalId = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySession(token);
  if (!userId) return null;

  const user = await findUserById(userId);
  if (!user) return null;
  if (user.role === "personal") return user.id;

  const student = await findStudentByUserId(user.id);
  return student?.professionalId ?? null;
});

const VAZIO: Database = {
  version: 2, users: [], students: [], exercises: [], trainingPlans: [], workouts: [],
  workoutExercises: [], workoutSessions: [], workoutSets: [], checkins: [], assessments: [],
  progressPhotos: [], habitLogs: [], habitTargets: [], consents: [], challenges: [], challengeMembers: [], challengeEntries: [], attendance: [], anamnesis: [], notifications: [],
};

export const getDb = cache(async (): Promise<Database> => {
  const proId = await currentProfessionalId();
  if (!proId) return VAZIO;
  return loadProfessionalData(proId);
});
