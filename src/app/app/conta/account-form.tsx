"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateAccountAction, type AccountState } from "@/lib/actions/personal";
import { Button, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar alterações"}
    </Button>
  );
}

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState<AccountState, FormData>(updateAccountAction, {});

  return (
    <form action={action} className="space-y-4">
      <Field label="Nome">
        <Input name="name" defaultValue={name} required />
      </Field>

      <Field label="E-mail de acesso">
        <Input name="email" type="email" defaultValue={email} required />
      </Field>

      <fieldset className="space-y-3 rounded-xl border border-ink-800 p-4">
        <legend className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          Trocar senha
        </legend>
        <p className="text-xs text-ink-500">
          Deixe em branco para manter a senha atual.
        </p>
        <Field label="Senha atual">
          <Input name="currentPassword" type="password" autoComplete="current-password" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nova senha">
            <Input name="newPassword" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nova senha">
            <Input name="confirmPassword" type="password" autoComplete="new-password" />
          </Field>
        </div>
      </fieldset>

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}

      <SubmitButton />
    </form>
  );
}
