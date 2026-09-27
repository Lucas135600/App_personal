"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { logChallengeEntryAction, type EntryState } from "@/lib/actions/student";
import { Button, Field, Input, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Salvando..." : "Registrar"}
    </Button>
  );
}

/** Registro do dia. Regravar o mesmo dia corrige o valor — não soma de novo. */
export function EntryForm({
  challengeId,
  hoje,
  unidade,
  decimal,
  requirePhoto,
  jaTemFoto,
  valorAtual,
}: {
  challengeId: string;
  hoje: string;
  unidade: string;
  decimal: boolean;
  requirePhoto: boolean;
  jaTemFoto: boolean;
  valorAtual: number | null;
}) {
  const [state, formAction] = useActionState<EntryState, FormData>(logChallengeEntryAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="date" value={hoje} />

      <Field
        label={`Hoje (${unidade})`}
        hint={valorAtual !== null ? "Você já registrou hoje. Salvar de novo corrige o valor." : undefined}
      >
        <Input
          name="value"
          inputMode={decimal ? "decimal" : "numeric"}
          defaultValue={valorAtual !== null ? String(valorAtual) : ""}
          placeholder="0"
          required
        />
      </Field>

      {requirePhoto && (
        <Field
          label={jaTemFoto ? "Trocar a foto (opcional)" : "Foto de comprovação"}
          hint={
            jaTemFoto
              ? "A foto que você já enviou continua valendo se deixar em branco."
              : "Visível para os participantes deste desafio, e só para eles."
          }
        >
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="block w-full text-xs text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink-100"
          />
        </Field>
      )}

      <Field label="Observação (opcional)">
        <Textarea name="note" rows={2} maxLength={200} placeholder="Como foi?" />
      </Field>

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}

      <SubmitButton />
    </form>
  );
}
