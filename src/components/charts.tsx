import { formatShortDate } from "@/lib/dates";

/* Gráficos em SVG puro, renderizados no servidor.
   Regras seguidas: uma série por eixo (nunca dois eixos y), marcas finas,
   grade recessiva, rotulo direto apenas no último ponto e identidade
   nunca dependente só da cor (rotulo textual sempre presente). */

const ACCENT = "var(--color-lime-accent)";
const GRID = "var(--color-ink-800)";
const AXIS_TEXT = "var(--color-ink-400)";

export interface Point {
  date: string;
  value: number;
}

export function LineChart({
  points,
  unit = "",
  height = 180,
  label,
  invertGood = false,
}: {
  points: Point[];
  unit?: string;
  height?: number;
  label: string;
  invertGood?: boolean;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-ink-700 text-sm text-ink-500">
        Dados insuficientes para o gráfico de {label.toLowerCase()}
      </div>
    );
  }

  const W = 640;
  const H = height;
  const padL = 44;
  const padR = 72;
  const padT = 16;
  const padB = 26;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.05);
  const min = rawMin - span * 0.25;
  const max = rawMax + span * 0.25;

  const x = (i: number) => padL + (i * (W - padL - padR)) / (points.length - 1);
  const y = (v: number) => padT + ((max - v) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const área = `${line} L${x(points.length - 1).toFixed(1)},${H - padB} L${padL},${H - padB} Z`;

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const delta = Number((last - first).toFixed(1));
  const improved = invertGood ? delta <= 0 : delta >= 0;
  const gridLines = [0, 0.5, 1];
  const gradientId = `grad-${label.replace(/\W/g, "")}`;

  return (
    <figure className="w-full">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</span>
        <span className="text-xs font-semibold" style={{ color: improved ? "var(--color-ok)" : "var(--color-warn)" }}>
          {delta > 0 ? "+" : ""}
          {delta}
          {unit} no período
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label}: de ${first}${unit} a ${last}${unit}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.22" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => {
          const v = min + (max - min) * (1 - g);
          return (
            <g key={g}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
              <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
                {v.toFixed(v > 50 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        <path d={área} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={`${p.date}-${i}`}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={i === points.length - 1 ? 4.5 : 3}
              fill={i === points.length - 1 ? ACCENT : "var(--color-ink-950)"}
              stroke={ACCENT}
              strokeWidth="2"
            />
            <circle cx={x(i)} cy={y(p.value)} r="12" fill="transparent">
              <title>{`${formatShortDate(p.date)} - ${p.value}${unit}`}</title>
            </circle>
          </g>
        ))}

        <text x={x(points.length - 1) + 10} y={y(last) + 4} fontSize="12" fontWeight="700" fill="var(--color-ink-100)">
          {last}
          {unit}
        </text>
        <text x={padL} y={H - 6} fontSize="11" fill={AXIS_TEXT}>
          {formatShortDate(points[0].date)}
        </text>
        <text x={W - padR} y={H - 6} fontSize="11" textAnchor="end" fill={AXIS_TEXT}>
          {formatShortDate(points[points.length - 1].date)}
        </text>
      </svg>
    </figure>
  );
}

export interface TargetBar {
  label: string;
  done: number;
  planned: number;
}

/** Realizado x planejado: a barra clara é a meta, a barra lima o realizado. */
export function TargetBars({ data, label }: { data: TargetBar[]; label: string }) {
  const W = 640;
  const H = 180;
  const padT = 18;
  const padB = 30;
  const max = Math.max(1, ...data.map((d) => Math.max(d.done, d.planned)));
  const slot = W / data.length;
  const barW = Math.min(34, slot * 0.42);
  const scale = (v: number) => ((H - padT - padB) * v) / max;

  return (
    <figure className="w-full">
      <figcaption className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</span>
        <span className="flex items-center gap-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink-700" /> Planejado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-lime-accent" /> Realizado
          </span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <line x1="0" x2={W} y1={H - padB} y2={H - padB} stroke={GRID} strokeWidth="1" />
        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          const plannedH = scale(d.planned);
          const doneH = scale(d.done);
          return (
            <g key={d.label}>
              <rect
                x={cx - barW - 1}
                y={H - padB - plannedH}
                width={barW}
                height={Math.max(2, plannedH)}
                rx="4"
                fill="var(--color-ink-700)"
              >
                <title>{`${d.label} - planejado ${d.planned}`}</title>
              </rect>
              <rect
                x={cx + 1}
                y={H - padB - doneH}
                width={barW}
                height={Math.max(2, doneH)}
                rx="4"
                fill={d.done >= d.planned ? ACCENT : "var(--color-warn)"}
              >
                <title>{`${d.label} - realizado ${d.done}`}</title>
              </rect>
              <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Mini sparkline para linhas de tabela. */
export function Spark({ values, width = 88, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-xs text-ink-600">--</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i * width) / (values.length - 1);
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Anel de adesão: valor único, rótulo sempre textual junto. */
export function Ring({
  value,
  size = 96,
  caption,
}: {
  value: number;
  size?: number;
  caption?: string;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 85 ? "var(--color-ok)" : pct >= 65 ? "var(--color-warn)" : "var(--color-danger)";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${caption ?? "Adesão"}: ${pct}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-800)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={size * 0.24}
          fontWeight="700"
          fill="var(--color-ink-100)"
        >
          {pct}%
        </text>
      </svg>
      {caption && <span className="text-[11px] uppercase tracking-[0.1em] text-ink-400">{caption}</span>}
    </div>
  );
}
