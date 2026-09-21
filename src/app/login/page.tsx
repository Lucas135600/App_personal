import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "personal" ? "/app" : "/aluno");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm lb-enter">
        <div className="mb-10 text-center">
          <Logo size="lg" />
          <p className="mt-4 text-sm text-ink-400">
            Seu treino. Seu acompanhamento. Sua evolução.
          </p>
        </div>

        <LoginForm />

        <div className="mt-8 rounded-[18px] border border-ink-800 bg-ink-900 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Acessos de demonstração
          </p>
          <dl className="mt-3 space-y-2 text-xs text-ink-300">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-400">Personal</dt>
              <dd className="font-mono text-ink-200">lucas@lbpersonal.com / lb123456</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-400">Aluno</dt>
              <dd className="font-mono text-ink-200">joao@aluno.com / aluno123</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
