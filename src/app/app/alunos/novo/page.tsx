import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { Card } from "@/components/ui";
import { NewStudentForm } from "./student-form";

export default async function NewStudentPage() {
  await requirePersonal();

  return (
    <div className="mx-auto max-w-2xl space-y-6 lb-enter">
      <header>
        <Link href="/app/alunos" className="text-xs font-semibold text-ink-400 hover:text-ink-200">
          &larr; Alunos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Novo aluno</h1>
        <p className="mt-1 text-sm text-ink-400">
          O aluno recebe acesso ao aplicativo e a anamnese fica pendente para ele responder.
        </p>
      </header>

      <Card>
        <NewStudentForm />
      </Card>
    </div>
  );
}
