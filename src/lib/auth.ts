import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, hashPassword } from "./db";
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

export function authenticate(email: string, password: string): User | null {
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password)) return null;
  return user;
}

export async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return getDb().users.find((u) => u.id === userId) ?? null;
}

/** Sessão de personal obrigatoria. */
export async function requirePersonal(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "personal") redirect("/aluno");
  return user;
}

/** Sessão de aluno obrigatoria, já resolvendo o registro de aluno. */
export async function requireStudent(): Promise<{ user: User; student: Student }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/app");
  const student = getDb().students.find((s) => s.userId === user.id);
  if (!student) redirect("/login");
  return { user, student };
}

/** O personal só enxerga os próprios alunos (base do multi-tenant). */
export function assertOwnStudent(professionalId: string, studentId: string): Student {
  const student = getDb().students.find((s) => s.id === studentId);
  if (!student || student.professionalId !== professionalId) {
    throw new Error("Aluno não encontrado para este profissional.");
  }
  return student;
}
