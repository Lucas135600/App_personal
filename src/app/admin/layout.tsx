import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3">
          <Logo size="sm" />
          <span className="rounded-full bg-lime-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-lime-accent">
            Administração
          </span>
          <nav className="flex gap-1">
            <Link href="/admin/planos" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-100">
              Planos
            </Link>
            <Link href="/admin/socios" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-100">
              Sócios
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-ink-500 sm:inline">{user.email}</span>
            <Link href="/app" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-400 hover:text-ink-100">
              Voltar ao app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
