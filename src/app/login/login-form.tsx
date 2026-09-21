"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { Button, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4 rounded-[18px] border border-ink-800 bg-ink-900 p-6">
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" placeholder="voce@email.com" required />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" placeholder="********" required />
      </Field>

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
