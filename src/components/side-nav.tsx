"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ITEMS = [
  { href: "/app", label: "Dashboard", exact: true, icon: GridIcon },
  { href: "/app/alunos", label: "Alunos", icon: PeopleIcon },
  { href: "/app/avisos", label: "Avisos", badge: true, icon: BellIcon },
  { href: "/app/checkins", label: "Check-ins", icon: ClipboardIcon },
  { href: "/app/exercicios", label: "Exercícios", icon: DumbbellIcon },
  { href: "/app/agenda", label: "Agenda", icon: CalendarIcon },
  { href: "/app/desafios", label: "Desafios", icon: TrophyIcon },
  { href: "/app/assinatura", label: "Assinatura", icon: MoneyIcon },
  { href: "/app/conta", label: "Minha conta", icon: UserIcon },
];

export function SideNav({ unread, admin = false }: { unread: number; admin?: boolean }) {
  const pathname = usePathname();
  // O atalho da administração só existe para quem tem acesso; mostrá-lo a
  // todos e barrar no clique só ensinaria que a área existe.
  const itens = admin
    ? [...ITEMS, { href: "/admin", label: "Administração", icon: ShieldIcon }]
    : ITEMS;

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:mt-8 lg:flex-none lg:flex-col lg:items-stretch lg:gap-1 lg:overflow-visible">
      {itens.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-colors lg:px-3.5 lg:py-2.5",
              active
                ? "bg-lime-accent text-ink-950"
                : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
            )}
          >
            <span className="flex items-center gap-2.5">
              <Icon />
              <span className="flex-1">{item.label}</span>
              {"badge" in item && item.badge && unread > 0 && (
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    active ? "bg-ink-950/15 text-ink-950" : "bg-lime-accent/20 text-lime-accent",
                  )}
                >
                  {unread}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function GridIcon() {
  return (
    <svg {...ICON}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...ICON}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.5 5.5a3 3 0 0 1 0 5.6M18 14.2a5.5 5.5 0 0 1 3.2 5.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...ICON}>
      <path d="M18 9a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" />
      <path d="M10.3 19.5a2 2 0 0 0 3.4 0" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...ICON}>
      <rect x="4.5" y="4.5" width="15" height="16" rx="3" />
      <path d="M9 4.5V3.6A1.6 1.6 0 0 1 10.6 2h2.8A1.6 1.6 0 0 1 15 3.6v.9" />
      <path d="m8.8 12.5 2.2 2.2 4.2-4.4" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...ICON}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17.5h2M14 17.5h2" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg {...ICON}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11" />
      <path d="M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11" />
      <path d="M12 14v3M9 20h6M10 17h4" />
    </svg>
  );
}

/** Cifrão, como você pediu para a assinatura. */
function MoneyIcon() {
  return (
    <svg {...ICON}>
      <path d="M12 2.5v19" />
      <path d="M16.5 6.8A3.8 3.8 0 0 0 12.8 4.5h-1.4a3.4 3.4 0 0 0 0 6.8h1.2a3.6 3.6 0 0 1 0 7.2h-1.5a3.9 3.9 0 0 1-3.6-2.4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...ICON}>
      <path d="M12 2.8 5 5.6v5.3c0 4.4 2.9 8.4 7 9.6 4.1-1.2 7-5.2 7-9.6V5.6l-7-2.8Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
