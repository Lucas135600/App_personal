"use client";

import { useState } from "react";
import { submitCheckinAction } from "@/lib/actions/student";
import { Button, Card, Field, Input, Textarea, cx } from "@/components/ui";

const SCALES: Array<{ name: string; label: string; icons: string[] }> = [
  { name: "energy", label: "Como esteve sua disposição?", icons: ["😞", "😕", "😐", "🙂", "🔥"] },
  { name: "sleep", label: "Como esteve seu sono?", icons: ["😵", "😴", "😐", "🙂", "😃"] },
  { name: "nutrition", label: "Como esteve sua alimentação?", icons: ["🍔", "😕", "😐", "🥗", "💚"] },
  { name: "motivation", label: "Como está sua motivação?", icons: ["😞", "😕", "😐", "😃", "🚀"] },
];

function Scale({ name, label, icons }: { name: string; label: string; icons: string[] }) {
  const [value, setValue] = useState(4);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-200">{label}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {icons.map((icon, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setValue(n)}
              aria-pressed={value === n}
              className={cx(
                "rounded-xl py-2.5 text-xl transition-colors",
                value === n ? "bg-lime-accent" : "border border-ink-700 opacity-60",
              )}
            >
              {icon}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

export function CheckinForm({
  weekStart,
  defaultWorkouts,
}: {
  weekStart: string;
  defaultWorkouts: number;
}) {
  const [pain, setPain] = useState("nao");

  return (
    <Card>
      <form action={submitCheckinAction} className="space-y-5">
        <input type="hidden" name="weekStart" value={weekStart} />

        <Field label="Quantos treinos você realizou nesta semana?">
          <Input name="workoutsDone" type="number" inputMode="numeric" min={0} max={14} defaultValue={defaultWorkouts} />
        </Field>

        {SCALES.map((s) => (
          <Scale key={s.name} {...s} />
        ))}

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-200">Sentiu alguma dor?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "nao", label: "Não" },
              { value: "sim", label: "Sim" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPain(option.value)}
                className={cx(
                  "rounded-xl py-2.5 text-sm font-semibold transition-colors",
                  pain === option.value
                    ? "bg-lime-accent text-ink-950"
                    : "border border-ink-700 text-ink-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="pain" value={pain} />
          {pain === "sim" && (
            <div className="mt-3">
              <Field label="Onde e quando doeu?">
                <Input name="painNotes" placeholder="Ombro direito no supino" />
              </Field>
            </div>
          )}
        </div>

        <Field label="Peso atual (opcional)">
          <Input name="weight" inputMode="decimal" placeholder="87,4" />
        </Field>

        <Field label="Quer me contar mais alguma coisa?">
          <Textarea name="notes" placeholder="Semana corrida, dormi pouco na quarta..." />
        </Field>

        <Button type="submit" size="lg">
          Enviar check-in
        </Button>
      </form>
    </Card>
  );
}
