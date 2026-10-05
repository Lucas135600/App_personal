import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { logoutAction } from "@/lib/actions/auth";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui";
import { SideNav } from "@/components/side-nav";
import { isAdmin } from "@/lib/admin";
import { syncClassPrompts } from "@/lib/class-prompts";

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const pro = await requirePersonal();
  const db = await getDb();

  // As aulas que já terminaram e ninguém respondeu viram notificação aqui, na
  // entrada do painel: é o caminho por onde o personal sempre passa. O cron da
  // hospedagem faz a mesma varredura para quem não abriu o app no dia.
  const novas = await syncClassPrompts(db, pro.id);
  const unread =
    db.notifications.filter((n) => n.userId === pro.id && !n.read).length + novas;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-ink-800 bg-ink-900/95 px-4 py-3 backdrop-blur lg:h-dvh lg:w-64 lg:flex-col lg:items-stretch lg:justify-start lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <Link href="/app" className="shrink-0">
          <Logo size="sm" className="justify-start" />
        </Link>

        <SideNav unread={unread} admin={isAdmin(pro)} />

        <div className="hidden lg:mt-auto lg:block">
          <Link
            href="/app/conta"
            className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3 transition-colors hover:border-ink-600"
          >
            <Avatar name={pro.name} color={pro.avatarColor} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-100">{pro.name}</p>
              <p className="text-[11px] text-ink-400">Personal trainer</p>
            </div>
          </Link>
          <form action={logoutAction} className="mt-2">
            <button className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200">
              Sair da conta
            </button>
          </form>
        </div>

        <form action={logoutAction} className="lg:hidden">
          <button className="rounded-xl bg-ink-800 px-3 py-2 text-xs font-semibold text-ink-300">
            Sair
          </button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
