import { cache } from "react";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { findStudentByUserId, findUserById, loadProfessionalData } from "./repo";
import type { Database } from "./types";

/* getDb() devolve o mesmo formato que as telas sempre usaram, mas carregado do
 * Postgres e limitado ao profissional da sessão. Duas consequências:
 *
 * 1. Isolamento: ninguém carrega linha de outro profissional, nem por engano.
 * 2. Uma carga por requisição, não por chamada — o cache() do React garante
 *    isso mesmo quando a página chama getDb() em cinco lugares diferentes.
 */

const COOKIE = "lb_session";
const SECRET = process.env.LB_SESSION_SECRET ?? "lb360-dev-secret";

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const mac = crypto.createHmac("sha256", SECRET).update(userId).digest("hex").slice(0, 32);
  return `${userId}.${mac}` === token ? userId : null;
}

/** Profissional dono dos dados desta requisição: o próprio, se for o personal;
 *  o personal do aluno, se for aluno. */
const currentProfessionalId = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
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
  progressPhotos: [], habitLogs: [], attendance: [], anamnesis: [], notifications: [],
};

export const getDb = cache(async (): Promise<Database> => {
  const proId = await currentProfessionalId();
  if (!proId) return VAZIO;
  return loadProfessionalData(proId);
});
