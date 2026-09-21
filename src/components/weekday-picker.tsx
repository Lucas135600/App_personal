"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { cx } from "./ui";

export function WeekdayPicker({
  defaultValue = [],
  name = "weekdays",
}: {
  defaultValue?: number[];
  name?: string;
}) {
  const [selected, setSelected] = useState<number[]>(defaultValue);

  const toggle = (day: number) =>
    setSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));

  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_LABELS.map((label, day) => {
        const active = selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={active}
            className={cx(
              "h-10 w-12 rounded-xl text-xs font-bold transition-colors",
              active
                ? "bg-lime-accent text-ink-950"
                : "border border-ink-700 text-ink-400 hover:border-ink-500",
            )}
          >
            {label}
          </button>
        );
      })}
      {selected.map((day) => (
        <input key={day} type="hidden" name={name} value={day} />
      ))}
    </div>
  );
}
