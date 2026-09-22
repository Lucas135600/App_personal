"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveHabitTargetsAction, type HabitTargetsState } from "@/lib/actions/personal";
import { Button, Field, Input, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar metas"}
    </Button>
  );
}

/** O que o aluno tem que cumprir. Aparece na aba de hábitos dele, embaixo do
 *  nome de cada hábito, e é contra isto que ele marca cumpriu ou não cumpriu. */
export function HabitTargetsForm({
  studentId,
  waterLiters,
  nutrition,
  supplement,
}: {
  studentId: string;
  waterLiters: string;
  nutrition: string;
  supplement: string;
}) {
  const [state, formAction] = useActionState<HabitTargetsState, FormData>(
    saveHabitTargetsAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="studentId" value={studentId} />

      <Field label="Água por dia (litros)" hint="Deixe vazio ou 0 para não definir meta.">
        <Input
          name="waterLiters"
          inputMode="decimal"
          placeholder="3,5"
          defaultValue={waterLiters}
        />
      </Field>

      <Field label="Orientações de alimentação" hint="O aluno lê exatamente este texto.">
        <Textarea
          name="nutrition"
          placeholder="Ex.: 4 refeições, proteína em todas. Evitar ultraprocessados durante a semana."
          defaultValue={nutrition}
        />
      </Field>

      <Field label="Orientações de suplementação">
        <Textarea
          name="supplement"
          placeholder="Ex.: Whey pós-treino e creatina 5 g por dia."
          defaultValue={supplement}
        />
      </Field>

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}

      <SubmitButton />
    </form>
  );
}
