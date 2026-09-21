import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hashPassword } from "./db";
import { findStudentById, findStudentByUserId, findUserByEmail, findUserById } from "./repo";
import type { Student, User } from "./types";

const COOKIE = "lb_session";
const SECRET = process.env.LB_SESSION_SECRET ?? "lb360-dev-secret";

function sign(userId: string) {
  const mac = crypto.createHmac("sha256", SECRET).update(userId).digest("hex").slice(0, 32);
  return `${userId}.${mac}`;
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  return sign(userId) === token ? userId : null;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  // comparação em tempo constante: evita distinguir senha errada por tempo de resposta
  const esperado = Buffer.from(user.passwordHash);
  const recebido = Buffer.from(hashPassword(password));
  if (esperado.length !== recebido.length) return null;
  if (!crypto.timingSafeEqual(esperado, recebido)) return null;
  return user;
}

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return findUserById(userId);
});

/** Sessão de personal obrigatória. */
export async function requirePersonal(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "personal") redirect("/aluno");
  return user;
}

/** Sessão de aluno obrigatória, já resolvendo o registro de aluno. */
export async function requireStudent(): Promise<{ user: User; student: Student }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/app");
  const student = await findStudentByUserId(user.id);
  if (!student) redirect("/login");
  return { user, student };
}

/** O personal só enxerga os próprios alunos — base do multi-tenant. */
export async function assertOwnStudent(professionalId: string, studentId: string): Promise<Student> {
  const student = await findStudentById(studentId);
  if (!student || student.professionalId !== professionalId) {
    throw new Error("Aluno não encontrado para este profissional.");
  }
  return student;
}
