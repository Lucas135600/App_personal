"use client";

import { useState } from "react";
import { ANAMNESIS_STEPS } from "@/lib/anamnesis";
import { saveStudentAnamnesisAction } from "@/lib/actions/student";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";

/** Etapas curtas: 30 perguntas numa tela única derrubam a taxa de resposta. */
export function AnamnesisWizard({
  answers,
  answered,
}: {
  answers: Record<string, string>;
  answered: boolean;
}) {
  const [step, setStep] = useState(0);
  const total = ANAMNESIS_STEPS.length;
  const current = ANAMNESIS_STEPS[step];
  const last = step === total - 1;

  return (
    <form action={saveStudentAnamnesisAction} className="space-y-4">
      <div className="flex items-center gap-1.5">
        {ANAMNESIS_STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cx(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-lime-accent" : "bg-ink-800",
            )}
          />
        ))}
      </div>

      {/* As etapas ocultas continuam no DOM para que o submit envie tudo. */}
      {ANAMNESIS_STEPS.map((s, i) => (
        <div key={s.key} className={i === step ? "block" : "hidden"}>
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-accent">
              Etapa {i + 1} de {total}
            </p>
            <h2 className="mt-1 text-lg font-bold">{s.title}</h2>
            <p className="mt-1 text-sm text-ink-400">{s.description}</p>

            <div className="mt-5 space-y-4">
              {s.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.type === "textarea" ? (
                    <Textarea name={f.key} defaultValue={answers[f.key] ?? ""} />
                  ) : f.type === "select" ? (
                    <Select name={f.key} defaultValue={answers[f.key] ?? ""}>
                      <option value="">Selecione</option>
                      {f.options?.map((o) => <option key={o}>{o}</option>)}
                    </Select>
                  ) : (
                    <Input name={f.key} defaultValue={answers[f.key] ?? ""} />
                  )}
                </Field>
              ))}
            </div>
          </Card>
        </div>
      ))}

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
            Voltar
          </Button>
        )}
        {last ? (
          <Button type="submit" className="flex-1">
            {answered ? "Salvar alterações" : "Enviar anamnese"}
          </Button>
        ) : (
          <Button type="button" onClick={() => setStep((s) => s + 1)} className="flex-1">
            Próximo
          </Button>
        )}
      </div>

      <p className="text-center text-[11px] text-ink-600">
        Informações de saúde tratadas como dado sensível, com acesso restrito a você e ao seu personal.
      </p>
    </form>
  );
}
