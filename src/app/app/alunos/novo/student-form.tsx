"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createStudentAction, type NovoAlunoState } from "@/lib/actions/personal";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { WeekdayPicker } from "@/components/weekday-picker";
import { AccessModal } from "../access-modal";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Cadastrando..." : "Cadastrar aluno"}
    </Button>
  );
}

export function NewStudentForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<NovoAlunoState, FormData>(createStudentAction, {});
  const [fechado, setFechado] = useState(false);

  const mostrarAcesso = Boolean(state.acesso) && !fechado;

  return (
    <>
      <form action={formAction} className="space-y-4">
        <Field label="Nome completo">
          <Input name="name" required placeholder="Maria Silva" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail de acesso">
            <Input name="email" type="email" required placeholder="maria@email.com" />
          </Field>
          <Field
            label="Telefone"
            hint="Com DDD, para enviar o acesso pelo WhatsApp."
          >
            <Input name="phone" placeholder="(65) 90000-0000" />
          </Field>
        </div>

        {/* O campo de senha saiu daqui de propósito: o sistema gera. Senha
            escolhida por terceiro vira a mesma para todo mundo — era o que
            acontecia antes, com uma senha única para o app inteiro. */}
        <p className="rounded-xl border border-ink-800 bg-ink-850 px-3.5 py-3 text-xs leading-relaxed text-ink-400">
          A senha de primeiro acesso é gerada pelo sistema e aparece para você
          copiar assim que o cadastro for salvo. O aluno troca por uma dele no
          primeiro acesso.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de nascimento">
            <Input name="birthDate" type="date" />
          </Field>
          <Field label="Modalidade">
            <Select name="modality" defaultValue="online">
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
              <option value="hibrido">Híbrido</option>
            </Select>
          </Field>
        </div>

        <Field label="Objetivo">
          <Select name="goal" defaultValue="Hipertrofia">
            <option>Hipertrofia</option>
            <option>Emagrecimento</option>
            <option>Força</option>
            <option>Condicionamento</option>
            <option>Saúde e qualidade de vida</option>
            <option>Reabilitação / retorno</option>
          </Select>
        </Field>

        <Field label="Dias de treino previstos">
          <WeekdayPicker defaultValue={[1, 3, 5]} />
        </Field>

        <Field label="Observações do personal">
          <Textarea name="notes" placeholder="Restrições, histórico, pontos de atenção..." />
        </Field>

        {state.error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/app/alunos"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-400 hover:text-ink-200"
          >
            Cancelar
          </Link>
          <SubmitButton />
        </div>
      </form>

      {mostrarAcesso && state.acesso && (
        <AccessModal
          acesso={state.acesso}
          onClose={() => {
            setFechado(true);
            router.push(`/app/alunos/${state.acesso!.studentId}`);
          }}
        />
      )}
    </>
  );
}
