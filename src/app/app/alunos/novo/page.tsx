import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { createStudentAction } from "@/lib/actions/personal";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { WeekdayPicker } from "@/components/weekday-picker";

export default async function NewStudentPage() {
  await requirePersonal();

  return (
    <div className="mx-auto max-w-2xl space-y-6 lb-enter">
      <header>
        <Link href="/app/alunos" className="text-xs font-semibold text-ink-400 hover:text-ink-200">
          &larr; Alunos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Novo aluno</h1>
        <p className="mt-1 text-sm text-ink-400">
          O aluno recebe acesso ao aplicativo e a anamnese fica pendente para ele responder.
        </p>
      </header>

      <Card>
        <form action={createStudentAction} className="space-y-4">
          <Field label="Nome completo">
            <Input name="name" required placeholder="Maria Silva" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail de acesso">
              <Input name="email" type="email" required placeholder="maria@email.com" />
            </Field>
            <Field label="Senha inicial" hint="Padrão: aluno123">
              <Input name="password" placeholder="aluno123" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de nascimento">
              <Input name="birthDate" type="date" />
            </Field>
            <Field label="Telefone">
              <Input name="phone" placeholder="(65) 90000-0000" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Modalidade">
              <Select name="modality" defaultValue="online">
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
                <option value="hibrido">Híbrido</option>
              </Select>
            </Field>
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
          </div>

          <Field label="Dias de treino previstos">
            <WeekdayPicker defaultValue={[1, 3, 5]} />
          </Field>

          <Field label="Observações do personal">
            <Textarea name="notes" placeholder="Restrições, histórico, pontos de atenção..." />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/app/alunos"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-400 hover:text-ink-200"
            >
              Cancelar
            </Link>
            <Button type="submit">Cadastrar aluno</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
