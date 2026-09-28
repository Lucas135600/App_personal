"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { resetStudentPasswordAction, type NovoAlunoState } from "@/lib/actions/personal";
import { Button } from "@/components/ui";
import { AccessModal } from "../access-modal";

function SubmitButton({ primeira }: { primeira: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Gerando..." : primeira ? "Reenviar acesso" : "Gerar nova senha"}
    </Button>
  );
}

/** A senha de primeiro acesso não pode ser recuperada, só substituída — o banco
 *  guarda hash. Sem este botão, aluno que perde o acesso fica trancado. */
export function ResetPasswordButton({
  studentId,
  pendente,
}: {
  studentId: string;
  pendente: boolean;
}) {
  const [state, formAction] = useActionState<NovoAlunoState, FormData>(
    resetStudentPasswordAction,
    {},
  );
  const [fechado, setFechado] = useState(false);

  return (
    <>
      <form
        action={(fd) => {
          setFechado(false);
          return formAction(fd);
        }}
      >
        <input type="hidden" name="studentId" value={studentId} />
        <SubmitButton primeira={pendente} />
      </form>

      {state.error && (
        <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{state.error}</p>
      )}

      {state.acesso && !fechado && (
        <AccessModal acesso={state.acesso} onClose={() => setFechado(true)} />
      )}
    </>
  );
}
