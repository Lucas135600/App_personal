"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setAdminAction, type SocioState } from "@/lib/actions/admin";
import { Button, Field, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Liberando..." : "Liberar acesso"}
    </Button>
  );
}

export function SocioForm() {
  const [state, formAction] = useActionState<SocioState, FormData>(setAdminAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="acao" value="liberar" />
      <Field label="E-mail do sócio" hint="A pessoa precisa já ter conta no aplicativo.">
        <Input name="email" type="email" placeholder="socio@email.com" required />
      </Field>
      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}
      <SubmitButton />
    </form>
  );
}
