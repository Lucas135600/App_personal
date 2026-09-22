import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { estadoConsentimento } from "@/lib/consent";
import { Logo } from "@/components/logo";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = {
  title: "Autorizações — Vision Fitness",
};

/* Esta tela vive fora de /aluno de propósito: é o layout de /aluno que manda o
   aluno para cá quando falta o aceite, e se ela estivesse lá dentro o
   redirecionamento cairia em laço. */
export default async function ConsentPage() {
  const { user, student } = await requireStudent();
  const db = await getDb();

  if (estadoConsentimento(db, student.id).dados) redirect("/aluno");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <div className="mb-6 flex justify-center">
        <Logo size="md" />
      </div>
      <ConsentForm nome={user.name.split(" ")[0]} />
    </div>
  );
}
