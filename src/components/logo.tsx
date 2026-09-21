import { cx } from "./ui";

/* Marca: halter com arco de progresso subindo por cima.
   Desenhada em unidades de projeto 160x120; a viewBox recorta a caixa útil
   (33,27 94x91) para o símbolo centralizar sozinho em qualquer tamanho.
   A cauda da seta começa em x=50 e o ponto mais baixo fica em y=70: abaixo
   disso ela encostava na anilha esquerda, que começa em y=86.
   Alterar aqui pede rodar `npm run icons` — o gerador desenha a mesma forma. */
export function LogoMark({
  color = "currentColor",
  className,
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg viewBox="33 27 94 91" className={className} aria-hidden="true">
      <g
        fill="none"
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M50 70 L70 52 L88 64 L120 34" />
        <path d="M120 34 L120 52 M120 34 L102 34" />
      </g>
      <g fill={color}>
        <rect x="58" y="96" width="44" height="11" rx="5" />
        <rect x="46" y="86" width="12" height="31" rx="5" />
        <rect x="102" y="86" width="12" height="31" rx="5" />
        <rect x="34" y="93" width="9" height="17" rx="4" />
        <rect x="117" y="93" width="9" height="17" rx="4" />
      </g>
    </svg>
  );
}

export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const badge = size === "lg" ? 48 : size === "md" ? 34 : 28;

  return (
    <div className={cx("flex items-center justify-center gap-3", className)}>
      <svg width={badge} height={badge} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="var(--color-lime-accent)" />
        {/* svg aninhado: a própria viewBox encaixa e centraliza o símbolo */}
        <svg x="9" y="9.5" width="30" height="29" viewBox="33 27 94 91">
          <g
            fill="none"
            stroke="var(--color-ink-950)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M50 70 L70 52 L88 64 L120 34" />
            <path d="M120 34 L120 52 M120 34 L102 34" />
          </g>
          <g fill="var(--color-ink-950)">
            <rect x="58" y="96" width="44" height="11" rx="5" />
            <rect x="46" y="86" width="12" height="31" rx="5" />
            <rect x="102" y="86" width="12" height="31" rx="5" />
            <rect x="34" y="93" width="9" height="17" rx="4" />
            <rect x="117" y="93" width="9" height="17" rx="4" />
          </g>
        </svg>
      </svg>

      <div className="leading-none">
        <p
          className={cx(
            "font-extrabold tracking-tight text-ink-100",
            size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base",
          )}
        >
          LB PERSONAL
        </p>
        <p
          className={cx(
            "mt-1 font-semibold uppercase tracking-[0.3em] text-lime-accent",
            size === "lg" ? "text-[11px]" : "text-[9px]",
          )}
        >
          Trainner
        </p>
      </div>
    </div>
  );
}
