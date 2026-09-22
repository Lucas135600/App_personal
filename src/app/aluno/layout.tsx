import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { estadoConsentimento } from "@/lib/consent";
import { BottomNav } from "@/components/bottom-nav";
import { InstallBanner } from "@/components/pwa";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();

  /* Porta única: enquanto o aceite de tratamento de dados não existir, nenhuma
     tela do aluno abre. Ficar no layout, e não em cada página, é o que garante
     que uma tela nova criada amanhã já nasça protegida. */
  const db = await getDb();
  if (!estadoConsentimento(db, student.id).dados) redirect("/consentimento");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-6">{children}</main>
      <InstallBanner />
      <BottomNav />
    </div>
  );
}
