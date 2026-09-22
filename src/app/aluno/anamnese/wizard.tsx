"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ANAMNESIS_STEPS, etapaDoCampo } from "@/lib/anamnesis";
import { saveStudentAnamnesisAction, type AnamnesisState } from "@/lib/actions/student";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";

function SubmitButton({ answered }: { answered: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="flex-1">
      {pending ? "Salvando..." : answered ? "Salvar alterações" : "Enviar anamnese"}
    </Button>
  );
}

/** Etapas curtas: 30 perguntas numa tela única derrubam a taxa de resposta. */
export function AnamnesisWizard({
  answers,
  answered,
}: {
  answers: Record<string, string>;
  answered: boolean;
}) {
  const [step, setStep] = useState(0);
  const [state, formAction] = useActionState<AnamnesisState, FormData>(
    saveStudentAnamnesisAction,
    {},
  );
  const total = ANAMNESIS_STEPS.length;
  const last = step === total - 1;
  const faltando = state.faltando ?? [];

  /* Quando o servidor recusa por campo obrigatório vazio, o aluno está na
     última etapa e o campo que falta costuma estar duas etapas atrás — ou
     seja, fora da tela. Sem levá-lo até lá, a mensagem de erro vira acusação
     sem caminho. */
  useEffect(() => {
    if (faltando.length === 0) return;
    const alvo = etapaDoCampo(faltando[0]);
    if (alvo >= 0) setStep(alvo);
    // depende do resultado da ação, que é um objeto novo a cada envio
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={formAction} className="space-y-4">
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
              {s.fields.map((f) => {
                const vazio = faltando.includes(f.key);
                // borda vermelha só no que voltou do servidor como pendente:
                // pintar de vermelho antes de o aluno errar seria ansiedade à toa
                const erro = vazio ? "border-danger" : undefined;
                return (
                  <Field
                    key={f.key}
                    label={f.required ? `${f.label} *` : f.label}
                    hint={vazio ? "Obrigatório. Se não houver nada, escreva “nenhuma”." : undefined}
                  >
                    {f.type === "textarea" ? (
                      <Textarea name={f.key} defaultValue={answers[f.key] ?? ""} className={erro} />
                    ) : f.type === "select" ? (
                      <Select name={f.key} defaultValue={answers[f.key] ?? ""} className={erro}>
                        <option value="">Selecione</option>
                        {f.options?.map((o) => <option key={o}>{o}</option>)}
                      </Select>
                    ) : (
                      <Input name={f.key} defaultValue={answers[f.key] ?? ""} className={erro} />
                    )}
                  </Field>
                );
              })}
            </div>

            {s.fields.some((f) => f.required) && (
              <p className="mt-4 text-[11px] text-ink-500">
                * Obrigatório. Se não houver nada a declarar, escreva “nenhuma” — em
                branco não diz se não há nada ou se a pergunta foi pulada.
              </p>
            )}
          </Card>
        </div>
      ))}

      {/* Sem estas duas linhas a tela fica idêntica depois do envio, e quem
          respondeu não tem como saber se salvou. */}
      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
            Voltar
          </Button>
        )}
        {last ? (
          <SubmitButton answered={answered} />
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
