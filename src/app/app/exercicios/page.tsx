import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { saveExerciseAction } from "@/lib/actions/personal";
import { Badge, Button, Card, Field, Input, SectionTitle, Select, Textarea } from "@/components/ui";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; q?: string }>;
}) {
  await requirePersonal();
  const { g = "todos", q = "" } = await searchParams;
  const db = getDb();

  const groups = Array.from(new Set(db.exercises.map((e) => e.muscleGroup))).sort();
  const list = db.exercises
    .filter((e) => (g === "todos" ? true : e.muscleGroup === g))
    .filter((e) => (q ? e.name.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => a.name.localeCompare(b.name));

  const withoutVideo = db.exercises.filter((e) => !e.videoUrl).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Biblioteca de exercícios</h1>
        <p className="mt-1 text-sm text-ink-400">
          {db.exercises.length} exercícios &middot; {withoutVideo} ainda sem vídeo próprio
        </p>
      </header>

      <Card>
        <SectionTitle>Cadastrar exercício</SectionTitle>
        <form action={saveExerciseAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Nome"><Input name="name" required placeholder="Agachamento bulgaro" /></Field>
          <Field label="Grupo muscular"><Input name="muscleGroup" placeholder="Pernas" list="grupos" /></Field>
          <Field label="Equipamento"><Input name="equipment" placeholder="Halteres" /></Field>
          <datalist id="grupos">
            {groups.map((x) => <option key={x} value={x} />)}
          </datalist>
          <div className="sm:col-span-3">
            <Field
              label="URL do vídeo"
              hint="Use vídeos próprios ou com autorização de uso. Não inclua conteúdo de terceiros sem permissão."
            >
              <Input name="videoUrl" placeholder="https://..." />
            </Field>
          </div>
          <div className="sm:col-span-3"><Field label="Instruções"><Textarea name="instructions" /></Field></div>
          <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
            <Field label="Erros comuns"><Textarea name="commonMistakes" /></Field>
            <Field label="Dicas técnicas"><Textarea name="tips" /></Field>
          </div>
          <div className="sm:col-span-3"><Button type="submit">Adicionar a biblioteca</Button></div>
        </form>
      </Card>

      <form className="flex flex-wrap items-end gap-2">
        <Field label="Buscar">
          <Input name="q" defaultValue={q} placeholder="Nome do exercício" className="w-64" />
        </Field>
        <Field label="Grupo">
          <Select name="g" defaultValue={g} className="w-48">
            <option value="todos">Todos</option>
            {groups.map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="ghost">Filtrar</Button>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <Card key={e.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-ink-100">{e.name}</h3>
                <p className="text-xs text-ink-500">{e.muscleGroup} &middot; {e.equipment}</p>
              </div>
              {e.videoUrl ? <Badge tone="ok">vídeo</Badge> : <Badge tone="warn">sem vídeo</Badge>}
            </div>

            {e.instructions && <p className="mt-3 line-clamp-3 text-sm text-ink-300">{e.instructions}</p>}

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-lime-accent">editar</summary>
              <form action={saveExerciseAction} className="mt-3 space-y-2">
                <input type="hidden" name="exerciseId" value={e.id} />
                <Input name="name" defaultValue={e.name} />
                <div className="grid grid-cols-2 gap-2">
                  <Input name="muscleGroup" defaultValue={e.muscleGroup} />
                  <Input name="equipment" defaultValue={e.equipment} />
                </div>
                <Input name="videoUrl" defaultValue={e.videoUrl} placeholder="URL do vídeo" />
                <Textarea name="instructions" defaultValue={e.instructions} />
                <Textarea name="commonMistakes" defaultValue={e.commonMistakes} placeholder="Erros comuns" />
                <Textarea name="tips" defaultValue={e.tips} placeholder="Dicas" />
                <Button type="submit" variant="ghost" size="sm">Salvar</Button>
              </form>
            </details>
          </Card>
        ))}
      </div>

      {list.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-500">
          Nenhum exercício encontrado. <Link href="/app/exercicios" className="text-lime-accent">limpar filtros</Link>
        </p>
      )}
    </div>
  );
}
