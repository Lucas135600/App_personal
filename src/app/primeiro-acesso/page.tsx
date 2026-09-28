import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ChangePasswordForm } from "./change-form";

export const metadata: Metadata = { title: "Primeiro acesso — Vision Fitness" };

/* Fora de /aluno de propósito: é o layout de /aluno que manda para cá quando a
   senha ainda é a de primeiro acesso, e se esta tela estivesse lá dentro o
   redirecionamento cairia em laço. */
export default async function FirstAccessPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(user.role === "personal" ? "/app" : "/aluno");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-8 flex justify-center">
        <Logo size="md" />
      </div>
      <ChangePasswordForm nome={user.name.split(" ")[0]} />
    </div>
  );
}
