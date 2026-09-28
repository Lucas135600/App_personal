"use server";

import { redirect } from "next/navigation";
import { authenticate, currentUser, endSession, startSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { concluirPrimeiroAcesso } from "@/lib/repo-write";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Informe e-mail e senha." };

  const user = await authenticate(email, password);
  if (!user) return { error: "E-mail ou senha inválidos." };

  await startSession(user.id);
  redirect(user.role === "personal" ? "/app" : "/aluno");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

/* ------------------------------------------------- senha de primeiro acesso */

export interface FirstAccessState {
  error?: string;
}

/** Troca a senha de primeiro acesso pela do próprio usuário.
 *  Não pede a senha atual: quem chega aqui acabou de provar que a tem, ao
 *  entrar — e ela foi entregue pelo personal, então repeti-la não prova nada. */
export async function firstAccessPasswordAction(
  _prev: FirstAccessState,
  formData: FormData,
): Promise<FirstAccessState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(user.role === "personal" ? "/app" : "/aluno");

  const senha = String(formData.get("senha") ?? "");
  const confirma = String(formData.get("confirma") ?? "");

  if (senha.length < 8) return { error: "Use pelo menos 8 caracteres." };
  if (senha !== confirma) return { error: "As duas senhas não são iguais." };
  if (verifyPassword(senha, user.passwordHash).ok) {
    return { error: "Escolha uma senha diferente da que você recebeu." };
  }

  try {
    await concluirPrimeiroAcesso(user.id, hashPassword(senha));
  } catch (e) {
    console.error("firstAccessPasswordAction", e);
    return { error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }

  redirect(user.role === "personal" ? "/app" : "/aluno");
}
