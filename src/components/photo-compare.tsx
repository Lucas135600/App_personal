"use client";

import { useState } from "react";
import { formatMonth } from "@/lib/dates";
import { cx } from "./ui";

export interface PhotoSlot {
  angle: string;
  fileName: string | null;
}

export interface PhotoMonth {
  month: string;
  slots: PhotoSlot[];
}

const ANGLE_LABEL: Record<string, string> = {
  frente: "Frente",
  lateral: "Lateral",
  costas: "Costas",
};

/** Comparação antes x depois com cursor deslizante.
 *  As imagens vem da rota autenticada /api/foto. */
export function PhotoCompare({ months }: { months: PhotoMonth[] }) {
  const usable = months.filter((m) => m.slots.some((s) => s.fileName));
  const [angle, setAngle] = useState("frente");
  const [leftMonth, setLeftMonth] = useState(usable[0]?.month ?? "");
  const [rightMonth, setRightMonth] = useState(usable[usable.length - 1]?.month ?? "");
  const [split, setSplit] = useState(50);

  if (usable.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-ink-500">
        Ainda não há fotos registradas.
      </p>
    );
  }

  const fileFor = (month: string) =>
    usable.find((m) => m.month === month)?.slots.find((s) => s.angle === angle)?.fileName ?? null;

  const left = fileFor(leftMonth);
  const right = fileFor(rightMonth);
  const single = usable.length < 2 || leftMonth === rightMonth;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["frente", "lateral", "costas"].map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAngle(a)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              a === angle ? "bg-lime-accent text-ink-950" : "border border-ink-700 text-ink-300",
            )}
          >
            {ANGLE_LABEL[a]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">Antes</span>
          <select
            value={leftMonth}
            onChange={(e) => setLeftMonth(e.target.value)}
            className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm"
          >
            {usable.map((m) => (
              <option key={m.month} value={m.month}>
                {formatMonth(m.month)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">Depois</span>
          <select
            value={rightMonth}
            onChange={(e) => setRightMonth(e.target.value)}
            className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm"
          >
            {usable.map((m) => (
              <option key={m.month} value={m.month}>
                {formatMonth(m.month)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!left && !right ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-ink-500">
          Sem foto de {ANGLE_LABEL[angle].toLowerCase()} nos meses selecionados.
        </p>
      ) : single ? (
        <div className="overflow-hidden rounded-[18px] border border-ink-800 bg-ink-850">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/foto/${left ?? right}`} alt={`Foto ${angle}`} className="mx-auto max-h-[460px] object-contain" />
        </div>
      ) : (
        <>
          <div className="relative select-none overflow-hidden rounded-[18px] border border-ink-800 bg-ink-850">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-md">
              {right && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/foto/${right}`} alt="Depois" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {left && (
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${split}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/foto/${left}`}
                    alt="Antes"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ width: `${(100 / split) * 100}%`, maxWidth: "none" }}
                  />
                </div>
              )}
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-lime-accent" style={{ left: `${split}%` }} />
              <span className="absolute left-3 top-3 rounded-full bg-ink-950/75 px-2.5 py-1 text-[11px] font-bold">
                {formatMonth(leftMonth)}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-ink-950/75 px-2.5 py-1 text-[11px] font-bold">
                {formatMonth(rightMonth)}
              </span>
            </div>
          </div>
          <input
            type="range"
            min={2}
            max={98}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Deslize para comparar"
            className="w-full accent-[var(--color-lime-accent)]"
          />
          <p className="text-center text-xs text-ink-500">Deslize para comparar</p>
        </>
      )}
    </div>
  );
}
