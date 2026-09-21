"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { finishWorkoutAction } from "@/lib/actions/student";
import { Badge, Button, Card, Field, Input, Textarea, cx } from "@/components/ui";

export interface RunnerItem {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  videoUrl: string;
  instructions: string;
  commonMistakes: string;
  tips: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  load: number;
  restSeconds: number;
  rir: number;
  notes: string;
  lastLoad: number | null;
  lastReps: number | null;
}

interface LoggedSet {
  workoutExerciseId: string;
  setNumber: number;
  load: number;
  reps: number;
  rpe: number | null;
}

type Phase = "preview" | "running" | "finish";

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function VideoBlock({ item }: { item: RunnerItem }) {
  const url = item.videoUrl.trim();
  if (!url) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-700 bg-ink-850 text-center">
        <p className="text-sm font-semibold text-ink-300">Vídeo ainda não cadastrado</p>
        <p className="px-6 text-xs text-ink-500">
          Seu personal pode anexar a demonstração deste movimento na biblioteca de exercícios.
        </p>
      </div>
    );
  }

  const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (youtube) {
    return (
      <iframe
        className="aspect-video w-full rounded-xl border border-ink-800"
        src={`https://www.youtube.com/embed/${youtube[1]}`}
        title={item.name}
        allow="accelerometer; encrypted-média; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/média-has-caption
    <video className="aspect-video w-full rounded-xl border border-ink-800" src={url} controls playsInline />
  );
}

export function WorkoutRunner({
  workoutId,
  label,
  name,
  estimatedMinutes,
  items,
}: {
  workoutId: string;
  label: string;
  name: string;
  estimatedMinutes: number;
  items: RunnerItem[];
}) {
  const [phase, setPhase] = useState<Phase>("preview");
  const [startedAt, setStartedAt] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [exIdx, setExIdx] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [logged, setLogged] = useState<LoggedSet[]>([]);
  const [rest, setRest] = useState<number | null>(null);
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");

  const current = items[exIdx];
  const totalSets = useMemo(() => items.reduce((acc, i) => acc + i.sets, 0), [items]);
  const restRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      setRest(null);
      return;
    }
    restRef.current = window.setTimeout(() => setRest((r) => (r === null ? null : r - 1)), 1000);
    return () => {
      if (restRef.current) window.clearTimeout(restRef.current);
    };
  }, [rest]);

  useEffect(() => {
    if (!current) return;
    setLoad(String(current.lastLoad ?? current.load ?? ""));
    setReps(String(current.lastReps ?? current.repsMax ?? ""));
  }, [current]);

  function start() {
    setStartedAt(new Date().toISOString());
    setPhase("running");
  }

  function completeSet() {
    if (!current) return;
    setLogged((prev) => [
      ...prev,
      {
        workoutExerciseId: current.id,
        setNumber,
        load: Number(load.replace(",", ".")) || 0,
        reps: Number(reps) || 0,
        rpe: rpe ? Number(rpe) : null,
      },
    ]);

    const lastSetOfExercise = setNumber >= current.sets;
    const lastExercise = exIdx >= items.length - 1;

    if (lastSetOfExercise && lastExercise) {
      setRest(null);
      setPhase("finish");
      return;
    }

    if (lastSetOfExercise) {
      setExIdx((i) => i + 1);
      setSetNumber(1);
    } else {
      setSetNumber((n) => n + 1);
    }
    setRest(current.restSeconds);
  }

  /* ------------------------------------------------------------- preview */

  if (phase === "preview") {
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-accent">
            Treino {label}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {items.length} exercícios &middot; {totalSets} séries &middot; ~{estimatedMinutes} min
          </p>
          <Button size="lg" className="mt-4" onClick={start}>
            Iniciar treino
          </Button>
        </Card>

        <ol className="space-y-2">
          {items.map((it, i) => (
            <li key={it.id}>
              <Card>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-100">{it.name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {it.sets} x {it.repsMin}-{it.repsMax} &middot; {it.load} kg &middot; {it.restSeconds}s &middot; RIR {it.rir}
                    </p>
                    {it.notes && <p className="mt-1.5 text-xs text-ink-500">{it.notes}</p>}
                  </div>
                  {!it.videoUrl && <Badge tone="neutral">sem vídeo</Badge>}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  /* ------------------------------------------------------------ finalizar */

  if (phase === "finish") {
    return (
      <Card>
        <h1 className="text-xl font-bold tracking-tight">Como foi seu treino?</h1>
        <p className="mt-1 text-sm text-ink-400">
          {logged.length} séries registradas em {mmss(elapsed)}.
        </p>

        <form action={finishWorkoutAction} className="mt-5 space-y-4">
          <input type="hidden" name="workoutId" value={workoutId} />
          <input type="hidden" name="startedAt" value={startedAt} />
          <input type="hidden" name="sets" value={JSON.stringify(logged)} />
          <input type="hidden" name="rpe" value={rpe} />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Percepção de esforço (RPE)
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRpe(String(n))}
                  className={cx(
                    "rounded-xl py-2.5 text-sm font-bold transition-colors",
                    rpe === String(n)
                      ? "bg-lime-accent text-ink-950"
                      : "border border-ink-700 text-ink-300",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-ink-500">
              <span>1 muito fácil</span>
              <span>10 muito difícil</span>
            </div>
          </div>

          <Field label="Observações">
            <Textarea name="notes" placeholder="Senti dor no ombro na última série..." />
          </Field>

          <Button type="submit" size="lg">
            Finalizar treino
          </Button>
        </form>
      </Card>
    );
  }

  /* -------------------------------------------------------------- running */

  if (!current) return null;

  const doneSets = logged.length;

  return (
    <div className="space-y-4">
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
          <span className="text-xs font-semibold text-ink-400">
            Treino {label} &middot; {doneSets}/{totalSets} séries
          </span>
          <span className="rounded-lg bg-ink-850 px-2.5 py-1 font-mono text-sm tabular-nums text-lime-accent">
            {mmss(elapsed)}
          </span>
        </div>
        <div className="h-1 w-full bg-ink-800">
          <div
            className="h-full bg-lime-accent transition-[width] duration-500"
            style={{ width: `${(doneSets / totalSets) * 100}%` }}
          />
        </div>
      </Card>

      {rest !== null && (
        <Card className="border-lime-accent/40 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">Descanso</p>
          <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-lime-accent">{mmss(rest)}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRest((r) => (r ?? 0) + 30)}>
              +30s
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRest(null)}>
              Pular descanso
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-accent">
              Exercício {exIdx + 1} de {items.length}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{current.name}</h1>
            <p className="mt-0.5 text-xs text-ink-400">
              {current.muscleGroup} &middot; {current.equipment}
            </p>
          </div>
          <Badge tone="accent">
            Série {setNumber}/{current.sets}
          </Badge>
        </div>

        <div className="mt-4">
          <VideoBlock item={current} />
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-ink-850 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-ink-500">Alvo</dt>
            <dd className="text-sm font-bold">{current.repsMin}-{current.repsMax}</dd>
          </div>
          <div className="rounded-xl bg-ink-850 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-ink-500">Anterior</dt>
            <dd className="text-sm font-bold">{current.lastLoad != null ? `${current.lastLoad} kg` : "--"}</dd>
          </div>
          <div className="rounded-xl bg-ink-850 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-ink-500">RIR</dt>
            <dd className="text-sm font-bold">{current.rir}</dd>
          </div>
        </dl>

        {current.notes && (
          <p className="mt-3 rounded-xl bg-lime-accent/10 px-3 py-2 text-xs text-lime-soft">{current.notes}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Field label="Carga kg">
            <Input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} />
          </Field>
          <Field label="Reps">
            <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="RPE">
            <Input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="8" />
          </Field>
        </div>

        <Button size="lg" className="mt-4" onClick={completeSet}>
          Concluir série {setNumber}
        </Button>

        <button
          type="button"
          onClick={() => setPhase("finish")}
          className="mt-3 w-full text-xs font-semibold text-ink-500 hover:text-ink-300"
        >
          Encerrar treino agora
        </button>
      </Card>

      {(current.instructions || current.tips || current.commonMistakes) && (
        <details className="rounded-[18px] border border-ink-800 bg-ink-900 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink-200">Como executar</summary>
          <div className="mt-3 space-y-2 text-sm text-ink-300">
            {current.instructions && <p>{current.instructions}</p>}
            {current.tips && (
              <p>
                <span className="font-semibold text-lime-accent">Dica: </span>
                {current.tips}
              </p>
            )}
            {current.commonMistakes && (
              <p>
                <span className="font-semibold text-warn">Evite: </span>
                {current.commonMistakes}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
