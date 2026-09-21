"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const ITEMS = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/alunos", label: "Alunos" },
  { href: "/app/avisos", label: "Avisos", badge: true },
  { href: "/app/checkins", label: "Check-ins" },
  { href: "/app/exercicios", label: "Exercícios" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/conta", label: "Minha conta" },
];

export function SideNav({ unread }: { unread: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:mt-8 lg:flex-none lg:flex-col lg:items-stretch lg:gap-1 lg:overflow-visible">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
            <span className="flex items-center justify-between gap-2">
              {item.label}
              {item.badge && unread > 0 && (
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
