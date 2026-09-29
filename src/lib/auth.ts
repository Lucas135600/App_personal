import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hashPassword, verifyPassword } from "./password";
import { SESSION_COOKIE, signSession, verifySession } from "./session";
import { findStudentById, findStudentByUserId, findUserByEmail, findUserById } from "./repo";
import { updatePasswordHash } from "./repo-write";
import { isAdmin } from "./admin";
import type { Student, User } from "./types";

export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const { ok, precisaAtualizar } = verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  // senha no formato antigo: regrava em scrypt agora que temos o texto puro
  if (precisaAtualizar) {
    const novo = hashPassword(password);
    await updatePasswordHash(user.id, novo);
    return { ...user, passwordHash: novo };
  }
  return user;
}

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySession(token);
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

/** Área de administração: dono do aplicativo e sócios liberados por ele.
 *  Independe de ser personal — o dono é as duas coisas. */
export async function requireAdmin(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect(user.role === "personal" ? "/app" : "/aluno");
  return user;
}
