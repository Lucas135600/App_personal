"use client";

import { useActionState } from "react";
import { setAdminAction, type SocioState } from "@/lib/actions/admin";
import { Button } from "@/components/ui";

export function RemoveSocioForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<SocioState, FormData>(setAdminAction, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="acao" value="remover" />
      <Button type="submit" variant="ghost" size="sm">
        Remover
      </Button>
      {state.error && <p className="mt-1 text-[11px] leading-snug text-danger">{state.error}</p>}
    </form>
  );
}
