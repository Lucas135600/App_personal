"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { grantConsentAction, type ConsentState } from "@/lib/actions/student";
import { TERMO_DADOS, TERMO_IMAGEM } from "@/lib/consent";
import { Button, Card } from "@/components/ui";

function SubmitButton({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !habilitado} className="w-full">
      {pending ? "Registrando..." : "Concordar e continuar"}
    </Button>
  );
}

function Termo({
  termo,
  name,
  checked,
  onChange,
  obrigatorio,
}: {
  termo: typeof TERMO_DADOS | typeof TERMO_IMAGEM;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  obrigatorio: boolean;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-ink-100">{termo.titulo}</h2>
        <span
          className={
            obrigatorio
              ? "shrink-0 rounded-full bg-lime-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-accent"
              : "shrink-0 rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-300"
          }
        >
          {obrigatorio ? "Necessário" : "Opcional"}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {termo.itens.map((item) => (
          <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-300">
            <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {/* A caixa fica embaixo do texto, não em cima: marcar antes de ler é o
          padrão escuro que a LGPD chama de consentimento não informado. */}
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-lime-accent)]"
        />
        <span className="text-[13px] font-semibold leading-snug text-ink-100">{termo.resumo}</span>
      </label>
    </Card>
  );
}

export function ConsentForm({ nome }: { nome: string }) {
  const [dados, setDados] = useState(false);
  const [imagem, setImagem] = useState(false);
  const [state, formAction] = useActionState<ConsentState, FormData>(grantConsentAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">Olá, {nome}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
          Antes de começar, precisamos do seu aceite. Leia com calma — são as regras
          de como seus dados são usados aqui, e você pode mudar de ideia depois.
        </p>
      </header>

      <Termo
        termo={TERMO_DADOS}
        name="dados"
        checked={dados}
        onChange={setDados}
        obrigatorio
      />
      <Termo
        termo={TERMO_IMAGEM}
        name="imagem"
        checked={imagem}
        onChange={setImagem}
        obrigatorio={false}
      />

      {state.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}

      <SubmitButton habilitado={dados} />

      {!dados && (
        <p className="text-center text-[11px] text-ink-500">
          A primeira autorização é necessária: sem base legal para tratar dados de
          saúde não há como prestar o acompanhamento.
        </p>
      )}

      <p className="text-center text-[11px] leading-relaxed text-ink-600">
        Registramos a data e a versão do texto que você aceitou. Para rever, corrigir
        ou apagar seus dados, fale com seu personal a qualquer momento.
      </p>
    </form>
  );
}
