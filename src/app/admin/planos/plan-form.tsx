"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { savePlanAction, type PlanoState } from "@/lib/actions/admin";
import { Button, Field, Input } from "@/components/ui";
import type { SubscriptionPlan } from "@/lib/types";

function SubmitButton({ novo }: { novo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Salvando..." : novo ? "Adicionar plano" : "Salvar"}
    </Button>
  );
}

/** Centavos para o campo de texto: 3990 vira "39,90". */
function paraCampo(cents: number): string {
  return cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

export function PlanForm({ plano }: { plano?: SubscriptionPlan }) {
  const [state, formAction] = useActionState<PlanoState, FormData>(savePlanAction, {});
  const novo = !plano;

  return (
    <form action={formAction} className="space-y-3">
      {plano && <input type="hidden" name="planId" value={plano.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" hint="Como aparece para o personal.">
          <Input name="name" defaultValue={plano?.name ?? ""} placeholder="3 meses" required />
        </Field>
        <Field label="Duração (meses)">
          <Input name="months" inputMode="numeric" defaultValue={plano?.months ?? ""} placeholder="3" required />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Preço cobrado (R$)">
          <Input name="price" inputMode="decimal" defaultValue={paraCampo(plano?.priceCents ?? 0)} placeholder="119,00" required />
        </Field>
        <Field label='Preço "de" (R$)' hint="Vazio = sem desconto.">
          <Input name="listPrice" inputMode="decimal" defaultValue={paraCampo(plano?.listPriceCents ?? 0)} placeholder="239,40" />
        </Field>
        <Field label="Parcelas">
          <Input name="installments" inputMode="numeric" defaultValue={plano?.installments ?? 1} placeholder="3" />
        </Field>
      </div>

      <Field label="Descrição" hint="Vazio usa um texto padrão.">
        <Input
          name="description"
          defaultValue={plano?.description ?? ""}
          placeholder="3 meses de assinatura com alunos ilimitados"
        />
      </Field>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            name="active"
            defaultChecked={plano ? plano.active : true}
            className="size-4 accent-[var(--color-lime-accent)]"
          />
          Visível para os personais
        </label>
        <SubmitButton novo={novo} />
      </div>

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state.ok && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>}
    </form>
  );
}
