"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ANAMNESIS_STEPS } from "@/lib/anamnesis";
import { saveAnamnesisAction, type AnamnesisState } from "@/lib/actions/personal";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar anamnese"}
    </Button>
  );
}

/* Componente de cliente para poder dizer se salvou. A versão anterior era
 * servidor puro: enviava e a tela continuava idêntica, sem confirmação nem
 * erro — o que na prática é indistinguível de não ter salvado. */
export function AnamnesisForm({
  studentId,
  answers,
}: {
  studentId: string;
  answers: Record<string, string>;
}) {
  const [state, formAction] = useActionState<AnamnesisState, FormData>(saveAnamnesisAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="studentId" value={studentId} />
      {ANAMNESIS_STEPS.map((step) => (
        <fieldset key={step.key} className="rounded-xl border border-ink-800 p-4">
          <legend className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-accent">
            {step.title}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {step.fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Field label={f.label}>
                  {f.type === "textarea" ? (
                    <Textarea name={f.key} defaultValue={answers[f.key] ?? ""} />
                  ) : f.type === "select" ? (
                    <Select name={f.key} defaultValue={answers[f.key] ?? ""}>
                      <option value="">--</option>
                      {f.options?.map((o) => <option key={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input name={f.key} defaultValue={answers[f.key] ?? ""} />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}

      <SubmitButton />
    </form>
  );
}
