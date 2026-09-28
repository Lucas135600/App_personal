import { getDb } from "@/lib/scope";
import Link from "next/link";
import {
  activePlanWorkouts, buildStudentAttendance, checkinHistory, measurementSeries,
  resolveWorkout, weeklyFrequency, weightSeries,
  type StudentAttendance, type StudentDay, type StudentView,
} from "@/lib/queries";
import { LineChart, Ring, TargetBars } from "@/components/charts";
import {
  Badge, Button, Card, EmptyState, Field, Input, Progress, SectionTitle,
  Select, Stat, Textarea, toneForScore,
} from "@/components/ui";
import { WeekdayPicker } from "@/components/weekday-picker";
import { PhotoCompare } from "@/components/photo-compare";
import { estadoConsentimento } from "@/lib/consent";
import { ResetPasswordButton } from "./reset-password";
import { AnamnesisForm } from "./anamnesis-form";
import { HabitTargetsForm } from "./habit-targets-form";
import {
  addDays, addMonths, currentMonth, formatDate, formatMonthLong, formatShortDate,
  todayISO, WEEKDAY_LABELS,
} from "@/lib/dates";
import {
  addWorkoutExerciseAction, createAssessmentAction, createWorkoutAction,
  deleteWorkoutAction, removeWorkoutExerciseAction, replyCheckinAction,
  saveAnamnesisAction, updateStudentAction, updateWorkoutExerciseAction,
} from "@/lib/actions/personal";

import { capitalizeFirst, SCALE_LABEL } from "@/lib/labels";

type HabitKey = "water" | "nutrition" | "sleep" | "steps" | "supplement";

/* ------------------------------------------------------------ visão geral */

export async function OverviewTab({ view }: { view: StudentView }) {
  const db = await getDb();
  const conta = db.users.find((u) => u.id === view.student.userId);
  const freq = (await weeklyFrequency(view.student.id, 8)).map((p) => ({
    label: formatShortDate(p.weekStart),
    done: p.done,
    planned: p.planned,
  }));
  const weight = await weightSeries(view.student.id);
  const a = view.lastAssessment;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Peso atual" value={view.weight != null ? `${view.weight} kg` : "--"} sub={view.weightDelta != null ? `${view.weightDelta > 0 ? "+" : ""}${view.weightDelta} kg no período` : undefined} />
          <Stat label="Gordura" value={a?.bodyFat != null ? `${a.bodyFat}%` : "--"} />
          <Stat label="Massa magra" value={a?.muscleMass != null ? `${a.muscleMass} kg` : "--"} />
          <Stat label="Frequência" value={`${view.frequency}%`} tone={toneForScore(view.frequency)} sub={`${view.doneLast4Weeks}/${view.plannedLast4Weeks} treinos`} />
        </div>

        <Card>
          <SectionTitle
            action={
              <Badge tone={conta?.mustChangePassword ? "warn" : "ok"}>
                {conta?.mustChangePassword ? "não entrou ainda" : "acesso ativo"}
              </Badge>
            }
          >
            Acesso ao aplicativo
          </SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-400">
              {conta?.mustChangePassword
                ? "A senha de primeiro acesso ainda não foi trocada. Se o aluno perdeu, gere outra."
                : "O aluno já criou a senha dele. Você não consegue vê-la — só gerar uma nova de primeiro acesso."}
            </p>
            <ResetPasswordButton
              studentId={view.student.id}
              pendente={Boolean(conta?.mustChangePassword)}
            />
          </div>
        </Card>

        <Card>
          <TargetBars data={freq} label="Treinos por semana (8 semanas)" />
        </Card>

        <Card>
          <LineChart points={weight} unit=" kg" label="Peso" invertGood={view.student.goal === "Emagrecimento"} />
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <SectionTitle>Radar de adesão</SectionTitle>
          <div className="flex justify-center">
            <Ring value={view.adherence.overall} size={120} caption="Adesão geral" />
          </div>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              ["Treino", view.adherence.workouts],
              ["Check-in", view.adherence.checkins],
              ["Hábitos", view.adherence.habits],
            ].map(([label, value]) => (
              <li key={label as string}>
                <div className="flex justify-between">
                  <span className="text-ink-300">{label}</span>
                  <span className="tabular-nums text-ink-400">{value}%</span>
                </div>
                <Progress className="mt-1.5" value={value as number} tone={toneForScore(value as number)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Dados do aluno</SectionTitle>
          <form action={updateStudentAction} className="space-y-3">
            <input type="hidden" name="studentId" value={view.student.id} />
            <Field label="Nome">
              <Input name="name" defaultValue={view.user.name} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Modalidade">
                <Select name="modality" defaultValue={view.student.modality}>
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={view.student.status}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nascimento">
                <Input name="birthDate" type="date" defaultValue={view.student.birthDate} />
              </Field>
              <Field label="Telefone">
                <Input name="phone" defaultValue={view.student.phone} />
              </Field>
            </div>
            <Field label="Objetivo">
              <Input name="goal" defaultValue={view.student.goal} />
            </Field>
            <Field label="Dias de treino">
              <WeekdayPicker defaultValue={view.student.trainingDays} />
            </Field>
            <Field label="Observações do personal">
              <Textarea name="notes" defaultValue={view.student.notes} />
            </Field>
            <Button type="submit" variant="ghost" size="sm">Salvar alterações</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- treinos */

export async function WorkoutsTab({ view }: { view: StudentView }) {
  const db = await getDb();
  const { planName, workouts } = await activePlanWorkouts(view.student.id);
  const library = [...db.exercises].sort((a, b) => a.name.localeCompare(b.name));
  const resolvidos = await Promise.all(
    workouts.map(async (w) => ({ w, resolved: (await resolveWorkout(w.id, view.student.id))! })),
  );

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle action={<span className="text-xs text-ink-500">{planName || "Sem bloco ativo"}</span>}>
          Novo treino no bloco
        </SectionTitle>
        <form action={createWorkoutAction} className="grid gap-3 sm:grid-cols-[80px_1fr_auto]">
          <input type="hidden" name="studentId" value={view.student.id} />
          <Field label="Letra">
            <Input name="label" placeholder="D" maxLength={2} />
          </Field>
          <Field label="Nome do treino">
            <Input name="name" placeholder="Ombros + abdômen" required />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="ghost">Criar</Button>
          </div>
          <div className="sm:col-span-3">
            <Field label="Dias da semana">
              <WeekdayPicker />
            </Field>
          </div>
        </form>
      </Card>

      {workouts.length === 0 && (
        <EmptyState title="Nenhum treino prescrito" description="Crie o treino A para começar o bloco deste aluno." />
      )}

      {resolvidos.map(({ w, resolved }) => {
        return (
          <Card key={w.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  <span className="text-lime-accent">Treino {w.label}</span> &middot; {w.name}
                </h3>
                <p className="mt-0.5 text-xs text-ink-500">
                  {resolved.items.length} {resolved.items.length === 1 ? "exercício" : "exercícios"} &middot; {resolved.totalSets} séries &middot;{" "}
                  {w.weekdays.length ? w.weekdays.map((d) => WEEKDAY_LABELS[d]).join(" / ") : "sem dia fixo"} &middot; ~{w.estimatedMinutes} min
                </p>
              </div>
              <form action={deleteWorkoutAction}>
                <input type="hidden" name="studentId" value={view.student.id} />
                <input type="hidden" name="workoutId" value={w.id} />
                <Button type="submit" variant="danger" size="sm">Excluir treino</Button>
              </form>
            </div>

            <div className="space-y-2">
              {resolved.items.map((r, i) => (
                <details key={r.item.id} className="rounded-xl border border-ink-800 bg-ink-850">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <span className="w-6 shrink-0 text-xs font-bold text-ink-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-100">{r.exercise.name}</span>
                      <span className="block text-xs text-ink-500">
                        {r.item.sets} x {r.item.repsMin}-{r.item.repsMax} &middot; {r.item.load} kg &middot; {r.item.restSeconds}s &middot; RIR {r.item.rir}
                      </span>
                    </span>
                    {!r.exercise.videoUrl && <Badge tone="warn">sem vídeo</Badge>}
                  </summary>

                  <div className="border-t border-ink-800 p-4">
                    <form action={updateWorkoutExerciseAction} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                      <input type="hidden" name="studentId" value={view.student.id} />
                      <input type="hidden" name="itemId" value={r.item.id} />
                      <Field label="Séries"><Input name="sets" type="number" defaultValue={r.item.sets} /></Field>
                      <Field label="Rep min"><Input name="repsMin" type="number" defaultValue={r.item.repsMin} /></Field>
                      <Field label="Rep max"><Input name="repsMax" type="number" defaultValue={r.item.repsMax} /></Field>
                      <Field label="Carga kg"><Input name="load" type="number" step="0.5" defaultValue={r.item.load} /></Field>
                      <Field label="Descanso s"><Input name="restSeconds" type="number" defaultValue={r.item.restSeconds} /></Field>
                      <Field label="RIR"><Input name="rir" type="number" defaultValue={r.item.rir} /></Field>
                      <div className="col-span-2 sm:col-span-6">
                        <Field label="Observação"><Input name="notes" defaultValue={r.item.notes} /></Field>
                      </div>
                      <div className="col-span-2 flex gap-2 sm:col-span-6">
                        <Button type="submit" variant="ghost" size="sm">Salvar</Button>
                      </div>
                    </form>
                    <form action={removeWorkoutExerciseAction} className="mt-2">
                      <input type="hidden" name="studentId" value={view.student.id} />
                      <input type="hidden" name="itemId" value={r.item.id} />
                      <Button type="submit" variant="danger" size="sm">Remover exercício</Button>
                    </form>
                    {r.lastLoad != null && (
                      <p className="mt-3 text-xs text-ink-500">
                        Última execução registrada: {r.lastLoad} kg x {r.lastReps} reps
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>

            <form action={addWorkoutExerciseAction} className="mt-4 grid gap-3 border-t border-ink-800 pt-4 sm:grid-cols-[2fr_repeat(5,80px)_auto]">
              <input type="hidden" name="studentId" value={view.student.id} />
              <input type="hidden" name="workoutId" value={w.id} />
              <Field label="Exercício">
                <Select name="exerciseId" required defaultValue="">
                  <option value="" disabled>Selecione</option>
                  {library.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.muscleGroup})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Séries"><Input name="sets" type="number" defaultValue={3} /></Field>
              <Field label="Rep min"><Input name="repsMin" type="number" defaultValue={8} /></Field>
              <Field label="Rep max"><Input name="repsMax" type="number" defaultValue={12} /></Field>
              <Field label="Carga"><Input name="load" type="number" step="0.5" defaultValue={0} /></Field>
              <Field label="Desc. s"><Input name="restSeconds" type="number" defaultValue={60} /></Field>
              <div className="flex items-end">
                <Button type="submit" variant="ghost">Adicionar</Button>
              </div>
            </form>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- check-ins */

export async function CheckinsTab({ view }: { view: StudentView }) {
  const history = await checkinHistory(view.student.id, 10);

  return (
    <div className="space-y-4">
      {history.length === 0 && <EmptyState title="Nenhum check-in registrado" />}
      {history.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-100">
                Semana de {formatDate(c.weekStart)} a {formatDate(addDays(c.weekStart, 6))}
              </p>
              {c.answeredAt && <p className="text-xs text-ink-500">Respondido em {formatDate(c.answeredAt)}</p>}
            </div>
            <Badge tone={c.status === "respondido" ? "ok" : c.status === "pendente" ? "warn" : "danger"}>
              {c.status}
            </Badge>
          </div>

          {c.answers ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Treinos", `${c.answers.workoutsDone}`],
                  ["Disposição", SCALE_LABEL[c.answers.energy] ?? "--"],
                  ["Sono", SCALE_LABEL[c.answers.sleep] ?? "--"],
                  ["Alimentação", SCALE_LABEL[c.answers.nutrition] ?? "--"],
                  ["Motivação", SCALE_LABEL[c.answers.motivation] ?? "--"],
                  ["Peso", c.answers.weight != null ? `${c.answers.weight} kg` : "--"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-ink-850 px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-ink-500">{k}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink-100">{capitalizeFirst(v)}</dd>
                  </div>
                ))}
              </dl>
              {c.answers.pain && (
                <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
                  Relatou dor: {c.answers.painNotes || "sem detalhes"}
                </p>
              )}
              {c.answers.notes && (
                <p className="mt-3 rounded-xl bg-ink-850 px-3 py-2 text-sm text-ink-300">{c.answers.notes}</p>
              )}

              <form action={replyCheckinAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="checkinId" value={c.id} />
                <input type="hidden" name="studentId" value={view.student.id} />
                <Input name="coachReply" defaultValue={c.coachReply} placeholder="Resposta do personal..." />
                <Button type="submit" variant="ghost">Responder</Button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-500">Aguardando resposta do aluno.</p>
          )}
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- avaliações */

const MEASURE_FIELDS: Array<[keyof NonNullable<StudentView["lastAssessment"]>["measurements"], string]> = [
  ["cintura", "Cintura"],
  ["abdomen", "Abdômen"],
  ["quadril", "Quadril"],
  ["bracoD", "Braço D"],
  ["coxaD", "Coxa D"],
  ["peitoral", "Peitoral"],
];

export async function AssessmentsTab({ view }: { view: StudentView }) {
  const db = await getDb();
  const list = db.assessments
    .filter((a) => a.studentId === view.student.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const [cintura, bracoD] = await Promise.all([
    measurementSeries(view.student.id, "cintura"),
    measurementSeries(view.student.id, "bracoD"),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Nova avaliação física</SectionTitle>
        <form action={createAssessmentAction} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="studentId" value={view.student.id} />
          <Field label="Data"><Input name="date" type="date" defaultValue={todayISO()} /></Field>
          <Field label="Peso kg"><Input name="weight" type="number" step="0.1" /></Field>
          <Field label="Altura m"><Input name="height" type="number" step="0.01" defaultValue={view.lastAssessment?.height ?? undefined} /></Field>
          <Field label="Gordura %"><Input name="bodyFat" type="number" step="0.1" /></Field>
          <Field label="Massa magra kg"><Input name="muscleMass" type="number" step="0.1" /></Field>
          {MEASURE_FIELDS.map(([key, label]) => (
            <Field key={key} label={`${label} cm`}>
              <Input name={key} type="number" step="0.1" />
            </Field>
          ))}
          <div className="sm:col-span-4">
            <Field label="Observações"><Textarea name="notes" /></Field>
          </div>
          <div className="sm:col-span-4">
            <Button type="submit">Registrar avaliação</Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><LineChart points={cintura} unit=" cm" label="Cintura" invertGood /></Card>
        <Card><LineChart points={bracoD} unit=" cm" label="Braço direito" /></Card>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-[0.1em] text-ink-500">
                <th className="px-5 py-2.5">Data</th>
                <th className="px-3 py-2.5">Peso</th>
                <th className="px-3 py-2.5">IMC</th>
                <th className="px-3 py-2.5">Gordura</th>
                {MEASURE_FIELDS.map(([k, l]) => (
                  <th key={k} className="px-3 py-2.5">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const imc = a.weight && a.height ? (a.weight / (a.height * a.height)).toFixed(1) : "--";
                return (
                  <tr key={a.id} className="border-b border-ink-850 last:border-0">
                    <td className="px-5 py-3 font-semibold">{formatDate(a.date)}</td>
                    <td className="px-3 py-3 tabular-nums">{a.weight ?? "--"}</td>
                    <td className="px-3 py-3 tabular-nums">{imc}</td>
                    <td className="px-3 py-3 tabular-nums">{a.bodyFat ?? "--"}</td>
                    {MEASURE_FIELDS.map(([k]) => (
                      <td key={k} className="px-3 py-3 tabular-nums">{a.measurements[k] ?? "--"}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- evolução */

export async function EvolutionTab({ view }: { view: StudentView }) {
  const db = await getDb();
  const months = view.photoMonths.map((month) => ({
    month,
    slots: (["frente", "lateral", "costas"] as const).map((angle) => ({
      angle,
      fileName:
        db.progressPhotos.find(
          (p) => p.studentId === view.student.id && p.month === month && p.angle === angle,
        )?.fileName ?? null,
    })),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><LineChart points={await weightSeries(view.student.id)} unit=" kg" label="Peso" invertGood={view.student.goal === "Emagrecimento"} /></Card>
      <Card><LineChart points={await measurementSeries(view.student.id, "quadril")} unit=" cm" label="Quadril" invertGood /></Card>
      <Card className="lg:col-span-2">
        <SectionTitle>Fotos de evolução</SectionTitle>
        <p className="mb-4 text-xs text-ink-500">
          Dado sensível: visível apenas para o aluno e para você, com acesso autenticado por requisição.
        </p>
        <PhotoCompare months={months} />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- anamnese */

export async function AnamnesisTab({ view }: { view: StudentView }) {
  const db = await getDb();
  const a = db.anamnesis.find((x) => x.studentId === view.student.id);
  const answers = a?.answers ?? {};

  const consent = estadoConsentimento(db, view.student.id);

  return (
    <div className="space-y-4">
    <Card>
      <SectionTitle>Autorizações do aluno</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-850 px-3 py-2.5">
          <span className="text-sm text-ink-300">Dados de saúde</span>
          <Badge tone={consent.dados ? "ok" : "danger"}>
            {consent.dados ? `aceito em ${formatDate(consent.em.dados!.slice(0, 10))}` : "pendente"}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-850 px-3 py-2.5">
          <span className="text-sm text-ink-300">Fotos para avaliação</span>
          <Badge tone={consent.imagem ? "ok" : "neutral"}>
            {consent.imagem ? "autorizado" : "não autorizado"}
          </Badge>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Quem não autorizou o uso de fotos não vê o envio de imagem no aplicativo. A
        decisão é do aluno e ele pode mudar pelo próprio perfil.
      </p>
    </Card>

    <Card>
      <SectionTitle
        action={
          <span className="text-xs text-ink-500">
            {a?.answeredAt ? `Atualizada em ${formatDate(a.answeredAt)}` : "Pendente de resposta"}
          </span>
        }
      >
        Anamnese
      </SectionTitle>

      <AnamnesisForm studentId={view.student.id} answers={answers} />
    </Card>
    </div>
  );
}

/* ----------------------------------------------------------------- hábitos */

export async function HabitsTab({ view }: { view: StudentView }) {
  const db = await getDb();
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), -13 + i));
  const rows: Array<[string, HabitKey]> = [
    ["Água", "water"],
    ["Alimentação", "nutrition"],
    ["Sono", "sleep"],
    ["Passos", "steps"],
    ["Suplemento", "supplement"],
  ];

  const logs = new Map(
    db.habitLogs.filter((h) => h.studentId === view.student.id).map((h) => [h.date, h]),
  );
  const target = db.habitTargets.find((t) => t.studentId === view.student.id);
  // 3500 ml vira "3,5" no campo; 0 vira vazio, para não parecer meta definida.
  const litros = target && target.waterMl > 0 ? String(target.waterMl / 1000).replace(".", ",") : "";

  return (
    <div className="space-y-4">
    <Card>
      <SectionTitle
        action={
          <span className="text-xs text-ink-500">
            {target?.updatedAt ? `Atualizadas em ${formatDate(target.updatedAt)}` : "Sem metas definidas"}
          </span>
        }
      >
        Metas do aluno
      </SectionTitle>
      <p className="-mt-1 mb-4 text-xs text-ink-500">
        O aluno vê este texto na aba de hábitos e marca, dia a dia, se cumpriu ou não.
      </p>
      <HabitTargetsForm
        studentId={view.student.id}
        waterLiters={litros}
        nutrition={target?.nutrition ?? ""}
        supplement={target?.supplement ?? ""}
      />
    </Card>

    <Card padded={false}>
      <div className="p-5">
        <SectionTitle>Hábitos - últimos 14 dias</SectionTitle>
        <p className="text-xs text-ink-500">
          Registro de hábitos declarado pelo aluno. Não substitui prescrição nutricional.
        </p>
      </div>
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-500">
              <th className="py-2 text-left">Hábito</th>
              {days.map((d) => (
                <th key={d} className="py-2 text-center font-semibold">{formatShortDate(d)}</th>
              ))}
              <th className="py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => {
              // A porcentagem é sobre os dias que o aluno respondeu, não sobre
              // os 14: dia em branco não é falha dele, e tratar como falha
              // esconde quem cumpre bem mas esquece de marcar.
              const respondidos = days.filter((d) => (logs.get(d)?.[key] ?? 0) !== 0);
              const cumpridos = respondidos.filter((d) => logs.get(d)?.[key] === 1).length;
              return (
                <tr key={key} className="border-t border-ink-850">
                  <td className="py-2.5 pr-3 font-semibold text-ink-200">{label}</td>
                  {days.map((d) => {
                    const estado = logs.get(d)?.[key] ?? 0;
                    const cor =
                      estado === 1 ? "bg-lime-accent" : estado === 2 ? "bg-danger" : "bg-ink-800";
                    const leitura =
                      estado === 1 ? "cumpriu" : estado === 2 ? "não cumpriu" : "sem resposta";
                    return (
                      <td key={d} className="py-2.5 text-center">
                        <span
                          className={`inline-block size-3.5 rounded-[5px] ${cor}`}
                          title={`${label} em ${formatShortDate(d)}: ${leitura}`}
                        />
                      </td>
                    );
                  })}
                  <td className="py-2.5 text-right tabular-nums text-ink-300">
                    {respondidos.length
                      ? `${Math.round((cumpridos / respondidos.length) * 100)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-ink-500">
          <span className="mr-1 inline-block size-2.5 rounded bg-lime-accent align-middle" /> cumpriu
          <span className="ml-3 mr-1 inline-block size-2.5 rounded bg-danger align-middle" /> não cumpriu
          <span className="ml-3 mr-1 inline-block size-2.5 rounded bg-ink-800 align-middle" /> sem resposta
          <span className="ml-3">A porcentagem considera só os dias respondidos.</span>
        </p>
      </div>
    </Card>
    </div>
  );
}

/* --------------------------------------------------------------- histórico */

const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

export async function HistoryTab({ view, month }: { view: StudentView; month: string }) {
  const db = await getDb();
  const freq = await buildStudentAttendance(view.student.id, month);
  const sessions = db.workoutSessions
    .filter((s) => s.studentId === view.student.id && s.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 20);

  return (
    <div className="space-y-6">
      {freq && <AttendanceCalendar view={view} freq={freq} />}

      <SectionTitle>Treinos registrados</SectionTitle>
      {sessions.length === 0 && <EmptyState title="Nenhum treino registrado ainda" />}
      <div className="space-y-3">
      {sessions.map((s) => {
        const w = db.workouts.find((x) => x.id === s.workoutId);
        const sets = db.workoutSets.filter((x) => x.sessionId === s.id);
        const volume = sets.reduce((acc, x) => acc + x.load * x.reps, 0);
        return (
          <details key={s.id} className="rounded-[18px] border border-ink-800 bg-ink-900">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-lime-accent/15 font-bold text-lime-accent">
                {w?.label ?? "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-100">{w?.name ?? "Treino removido"}</span>
                <span className="block text-xs text-ink-500">
                  {formatDate(s.startedAt)} &middot; {sets.length} séries &middot; volume {Math.round(volume).toLocaleString("pt-BR")} kg
                </span>
              </span>
              {s.rpe != null && <Badge tone={s.rpe >= 9 ? "danger" : s.rpe >= 7 ? "warn" : "ok"}>RPE {s.rpe}</Badge>}
            </summary>
            <div className="border-t border-ink-800 p-4">
              <ul className="space-y-1.5 text-sm">
                {Object.entries(
                  sets.reduce<Record<string, typeof sets>>((acc, x) => {
                    (acc[x.workoutExerciseId] ??= []).push(x);
                    return acc;
                  }, {}),
                ).map(([weId, group]) => {
                  const we = db.workoutExercises.find((x) => x.id === weId);
                  const ex = db.exercises.find((x) => x.id === we?.exerciseId);
                  return (
                    <li key={weId} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-ink-200">{ex?.name ?? "Exercício"}</span>
                      <span className="text-xs text-ink-500">
                        {group.map((g) => `${g.load}kg x ${g.reps}`).join("  |  ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {s.notes && <p className="mt-3 rounded-xl bg-ink-850 px-3 py-2 text-sm text-ink-300">{s.notes}</p>}
            </div>
          </details>
        );
      })}
      </div>
    </div>
  );
}

async function AttendanceCalendar({
  view,
  freq,
}: {
  view: StudentView;
  freq: StudentAttendance;
}) {
  const href = (m: string) => `/app/alunos/${view.student.id}?tab=historico&mes=${m}`;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <SectionTitle>Frequência</SectionTitle>
        <div className="mb-4 flex items-center gap-1">
          <Link
            href={href(addMonths(freq.month, -1))}
            className="rounded-lg px-2.5 py-1 text-sm font-semibold text-ink-300 hover:bg-ink-800"
          >
            &larr;
          </Link>
          <span className="min-w-[8.5rem] text-center text-xs font-bold">
            {capitalizeFirst(formatMonthLong(freq.month))}
          </span>
          <Link
            href={href(addMonths(freq.month, 1))}
            className="rounded-lg px-2.5 py-1 text-sm font-semibold text-ink-300 hover:bg-ink-800"
          >
            &rarr;
          </Link>
          {freq.month !== currentMonth() && (
            <Link
              href={href(currentMonth())}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-lime-accent hover:bg-ink-800"
            >
              hoje
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4">
        <Stat label="Previstas" value={freq.previstas} />
        <Stat label="Realizadas" value={freq.realizadas} tone="accent" />
        <Stat label="Faltas" value={freq.faltas || "--"} tone={freq.faltas ? "warn" : "neutral"} />
        <Stat
          label="Aproveitamento"
          value={freq.previstas ? `${freq.aproveitamento}%` : "--"}
          tone={freq.previstas ? toneForScore(freq.aproveitamento) : "neutral"}
        />
      </div>

      <div className="overflow-x-auto px-5">
        <div className="min-w-[360px] max-w-[460px]">
          <div className="grid grid-cols-7 gap-1.5 pb-1.5">
            {ORDEM_SEMANA.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink-500"
              >
                {WEEKDAY_LABELS[d]}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {freq.weeks.map((week) => (
              <div key={week[0].date} className="grid grid-cols-7 gap-1.5">
                {week.map((day) => (
                  <AttendanceCell key={day.date} day={day} ocupaHorario={freq.ocupaHorario} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-5 pt-4 text-[11px] text-ink-500">
        <Legend className="bg-lime-accent" label="treinou" />
        <Legend className="border-2 border-ink-600" label="previsto, sem registro" />
        <Legend className="bg-danger/70" label="falta" />
        <Legend className="bg-ink-800" label="sem treino previsto" />
        {freq.extras > 0 && (
          <span className="ml-auto">
            {freq.extras} {freq.extras === 1 ? "treino extra" : "treinos extras"} fora da grade
          </span>
        )}
      </div>
    </Card>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-[5px] ${className}`} />
      {label}
    </span>
  );
}

function AttendanceCell({ day, ocupaHorario }: { day: StudentDay; ocupaHorario: boolean }) {
  const feito = ocupaHorario ? day.present || day.trained : day.trained;
  const pendente = day.scheduled && !feito && !day.absent && !day.isFuture;

  const estado = feito
    ? "bg-lime-accent text-ink-950"
    : day.absent
      ? "bg-danger/70 text-ink-950"
      : pendente
        ? "border-2 border-ink-600 text-ink-400"
        : day.scheduled
          ? "border-2 border-dashed border-ink-700 text-ink-500"
          : "bg-ink-850 text-ink-600";

  const titulo = feito
    ? `${formatDate(day.date)} — treinou${day.workoutLabel ? ` (treino ${day.workoutLabel})` : ""}`
    : day.absent
      ? `${formatDate(day.date)} — falta`
      : day.scheduled
        ? `${formatDate(day.date)} — previsto`
        : formatDate(day.date);

  return (
    <div
      title={titulo}
      className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ${estado} ${
        day.inMonth ? "" : "opacity-30"
      } ${day.isToday ? "ring-2 ring-lime-accent ring-offset-2 ring-offset-ink-900" : ""}`}
    >
      {day.day}
      {feito && day.workoutLabel && (
        <span className="text-[8px] font-extrabold opacity-70">{day.workoutLabel}</span>
      )}
    </div>
  );
}
