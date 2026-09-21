"use server";

import { redirect } from "next/navigation";
import { authenticate, endSession, startSession } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Informe e-mail e senha." };

  const user = authenticate(email, password);
  if (!user) return { error: "E-mail ou senha inválidos." };

  await startSession(user.id);
  redirect(user.role === "personal" ? "/app" : "/aluno");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
