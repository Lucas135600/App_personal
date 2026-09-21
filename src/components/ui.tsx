import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-[18px] border border-ink-800 bg-ink-900",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {children}
      </h2>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-lime-accent text-ink-950 hover:bg-lime-soft",
  ghost: "bg-ink-800 text-ink-100 hover:bg-ink-700",
  outline: "border border-ink-600 text-ink-200 hover:border-ink-400 hover:text-ink-100",
  danger: "bg-danger/15 text-danger hover:bg-danger/25",
};

export function Button({
  variant = "primary",
  className,
  size = "md",
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "w-full px-5 py-3.5 text-base",
        BUTTON_STYLES[variant],
        className,
      )}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <Link
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "w-full px-5 py-3.5 text-base",
        BUTTON_STYLES[variant],
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition-colors placeholder:text-ink-500 focus:border-lime-accent";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={cx(CONTROL, className)} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={cx(CONTROL, "min-h-[90px] resize-y", className)} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select {...rest} className={cx(CONTROL, "appearance-none pr-9", className)} />;
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-800 text-ink-300",
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  accent: "bg-lime-accent/15 text-lime-accent",
  info: "bg-info/15 text-info",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  const color =
    tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "danger" ? "bg-danger" : "bg-ink-500";
  return <span className={cx("inline-block size-2 rounded-full", color)} />;
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  const valueTone =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : tone === "accent" ? "text-lime-accent" : "text-ink-100";
  return (
    <div className="rounded-[18px] border border-ink-800 bg-ink-900 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      <p className={cx("mt-2 text-2xl font-bold tabular-nums", valueTone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

export function Progress({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const bar =
    tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "danger" ? "bg-danger" : "bg-lime-accent";
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-ink-800", className)}>
      <div
        className={cx("h-full rounded-full transition-[width] duration-500", bar)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function toneForScore(score: number): Tone {
  if (score >= 85) return "ok";
  if (score >= 65) return "warn";
  return "danger";
}

export function Avatar({
  name,
  color,
  size = 40,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink-950"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[18px] border border-dashed border-ink-700 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-200">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
