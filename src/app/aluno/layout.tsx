import { requireStudent } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { InstallBanner } from "@/components/pwa";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-6">{children}</main>
      <InstallBanner />
      <BottomNav />
    </div>
  );
}
