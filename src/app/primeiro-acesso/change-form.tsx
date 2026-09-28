"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { firstAccessPasswordAction, type FirstAccessState } from "@/lib/actions/auth";
import { Button, Card, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Salvando..." : "Criar minha senha"}
    </Button>
  );
}

export function ChangePasswordForm({ nome }: { nome: string }) {
  const [state, formAction] = useActionState<FirstAccessState, FormData>(
    firstAccessPasswordAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
          A senha que você recebeu serve só para esta primeira entrada. Crie a sua
          agora — ela fica só com você, nem seu personal consegue ver.
        </p>
      </header>

      <Card>
        <Field label="Nova senha" hint="Pelo menos 8 caracteres.">
          <Input name="senha" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <div className="mt-4">
          <Field label="Repita a nova senha">
            <Input name="confirma" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
        </div>

        {state.error && (
          <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
        )}

        <div className="mt-5">
          <SubmitButton />
        </div>
      </Card>

      <p className="text-center text-[11px] leading-relaxed text-ink-600">
        Guardamos sua senha embaralhada, de um jeito que não dá para desfazer.
        Se esquecer, seu personal gera outra de primeiro acesso.
      </p>
    </form>
  );
}
