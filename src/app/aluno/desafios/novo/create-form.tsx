"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createChallengeAction, type ChallengeState } from "@/lib/actions/student";
import { GOALS, PERIODOS } from "@/lib/challenges";
import type { ChallengeGoal, ChallengePeriod } from "@/lib/types";
import { Avatar, Button, Card, Field, Input, SectionTitle, cx } from "@/components/ui";

export interface Convidavel {
  studentId: string;
  nome: string;
  avatarColor: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Criando..." : "Criar desafio"}
    </Button>
  );
}

const ORDEM: ChallengeGoal[] = ["cardio_min", "corrida_km", "abdominais", "treinos", "habitos"];

export function CreateChallengeForm({ candidatos }: { candidatos: Convidavel[] }) {
  const [state, formAction] = useActionState<ChallengeState, FormData>(createChallengeAction, {});
  const [kind, setKind] = useState<"duelo" | "grupo">("duelo");
  const [goal, setGoal] = useState<ChallengeGoal>("cardio_min");
  const [period, setPeriod] = useState<ChallengePeriod>("diario");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  const def = GOALS[goal];
  const automatico = def.automatico;

  /* Num duelo só cabe uma pessoa: trocar a escolha é mais natural do que
     receber um erro por ter marcado a segunda. */
  function alternar(id: string) {
    setEscolhidos((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      return kind === "duelo" ? [id] : [...atual, id];
    });
  }

  function trocarTipo(novo: "duelo" | "grupo") {
    setKind(novo);
    if (novo === "duelo") setEscolhidos((a) => a.slice(0, 1));
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <SectionTitle>O desafio</SectionTitle>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["duelo", "grupo"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => trocarTipo(k)}
              className={cx(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                kind === k ? "border-lime-accent bg-lime-accent/10" : "border-ink-800 bg-ink-850",
              )}
            >
              <span className="block text-sm font-bold text-ink-100">
                {k === "duelo" ? "X1" : "Grupo"}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">
                {k === "duelo" ? "Você contra mais uma pessoa" : "Você e quantos quiser"}
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />

        <Field label="Nome do desafio">
          <Input name="name" placeholder="Ex.: Outubro sem desculpa" maxLength={60} required />
        </Field>
      </Card>

      <Card>
        <SectionTitle>O que vale ponto</SectionTitle>
        <div className="space-y-2">
          {ORDEM.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setGoal(g);
                if (GOALS[g].automatico) setPeriod("total");
              }}
              className={cx(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                goal === g ? "border-lime-accent bg-lime-accent/10" : "border-ink-800 bg-ink-850",
              )}
            >
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink-100">{GOALS[g].label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">
                  {GOALS[g].exemplo}
                </span>
              </span>
              {GOALS[g].automatico && (
                <span className="shrink-0 rounded-full bg-ink-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-300">
                  automático
                </span>
              )}
            </button>
          ))}
        </div>
        <input type="hidden" name="goal" value={goal} />
      </Card>

      <Card>
        <SectionTitle>Como conta</SectionTitle>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PERIODOS) as ChallengePeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              disabled={automatico && p !== "total"}
              onClick={() => setPeriod(p)}
              className={cx(
                "rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                period === p ? "border-lime-accent bg-lime-accent/10 text-ink-100" : "border-ink-800 bg-ink-850 text-ink-300",
                automatico && p !== "total" && "opacity-35",
              )}
            >
              {PERIODOS[p]}
            </button>
          ))}
        </div>
        <input type="hidden" name="period" value={period} />

        {automatico && (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
            Metas automáticas somam o período inteiro — vence quem fizer mais. Não há o
            que registrar nem o que comprovar.
          </p>
        )}

        {!automatico && period !== "total" && (
          <div className="mt-4">
            <Field
              label={`Meta ${period === "diario" ? "por dia" : "por semana"} (${def.unidade})`}
              hint="Quem bater a meta soma um ponto naquele período."
            >
              <Input
                name="target"
                inputMode={def.decimal ? "decimal" : "numeric"}
                defaultValue={String(def.sugestao)}
                required
              />
            </Field>
          </div>
        )}

        <div className="mt-4">
          <Field label="Duração (dias)">
            <Input name="dias" inputMode="numeric" defaultValue="14" required />
          </Field>
        </div>

        {!automatico && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3">
            <input
              type="checkbox"
              name="requirePhoto"
              defaultChecked
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-lime-accent)]"
            />
            <span>
              <span className="block text-[13px] font-semibold text-ink-100">
                Exigir foto para validar
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">
                Cada registro precisa de uma foto. Ela fica visível para os participantes
                deste desafio — e só para eles.
              </span>
            </span>
          </label>
        )}
      </Card>

      <Card>
        <SectionTitle
          action={
            <span className="text-xs text-ink-500">
              {escolhidos.length} escolhido{escolhidos.length === 1 ? "" : "s"}
            </span>
          }
        >
          Quem você chama
        </SectionTitle>

        {candidatos.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-400">
            Ninguém com perfil público por aqui ainda. Só aparecem nesta lista os alunos do
            seu personal que deixaram o perfil visível — no perfil deles.
          </p>
        ) : (
          <div className="space-y-2">
            {candidatos.map((c) => {
              const marcado = escolhidos.includes(c.studentId);
              return (
                <button
                  key={c.studentId}
                  type="button"
                  onClick={() => alternar(c.studentId)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    marcado ? "border-lime-accent bg-lime-accent/10" : "border-ink-800 bg-ink-850",
                  )}
                >
                  <Avatar name={c.nome} color={c.avatarColor} size={32} />
                  <span className="flex-1 text-sm font-semibold text-ink-100">{c.nome}</span>
                  <span
                    className={cx(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
                      marcado ? "bg-lime-accent text-ink-950" : "border border-ink-600",
                    )}
                  >
                    {marcado ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {escolhidos.map((id) => (
          <input key={id} type="hidden" name="convidados" value={id} />
        ))}
      </Card>

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
