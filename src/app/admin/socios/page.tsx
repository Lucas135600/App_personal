import { requireAdmin } from "@/lib/auth";
import { listAdmins } from "@/lib/repo";
import { adminDoAmbiente } from "@/lib/admin";
import { Avatar, Badge, Card, SectionTitle } from "@/components/ui";
import { SocioForm } from "./socio-form";
import { RemoveSocioForm } from "./remove-form";

export default async function AdminPartnersPage() {
  const eu = await requireAdmin();
  const admins = await listAdmins();

  /* Quem vem da hospedagem pode não estar marcado no banco; ainda assim é
     administrador, e omiti-lo daria a impressão de que o acesso sumiu. */
  const listados = new Set(admins.map((a) => a.email.toLowerCase()));
  const soNoAmbiente =
    adminDoAmbiente(eu.email) && !listados.has(eu.email.toLowerCase()) ? eu : null;

  return (
    <div className="space-y-6 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sócios proprietários</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-400">
          Quem tem acesso a esta área cadastra os planos que todo personal enxerga.
          Não vê aluno, treino nem dado de saúde de ninguém.
        </p>
      </header>

      <Card>
        <SectionTitle>Liberar um sócio</SectionTitle>
        <SocioForm />
      </Card>

      <Card>
        <SectionTitle>Com acesso hoje</SectionTitle>
        <ul className="space-y-2">
          {soNoAmbiente && (
            <li className="flex items-center gap-3 rounded-xl bg-ink-850 px-3 py-2.5">
              <Avatar name={soNoAmbiente.name} color={soNoAmbiente.avatarColor} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-100">
                  {soNoAmbiente.name}
                </span>
                <span className="block truncate text-xs text-ink-500">{soNoAmbiente.email}</span>
              </span>
              <Badge tone="accent">hospedagem</Badge>
            </li>
          )}
          {admins.map((a) => {
            const doAmbiente = adminDoAmbiente(a.email);
            const souEu = a.id === eu.id;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-xl bg-ink-850 px-3 py-2.5">
                <Avatar name={a.name} color={a.avatarColor} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-100">
                    {a.name}
                    {souEu && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-lime-accent">
                        você
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink-500">{a.email}</span>
                </span>
                {doAmbiente ? (
                  <Badge tone="accent">hospedagem</Badge>
                ) : souEu ? (
                  <Badge tone="neutral">você</Badge>
                ) : (
                  <RemoveSocioForm email={a.email} />
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
          O acesso marcado como <strong>hospedagem</strong> vem da variável{" "}
          <code className="rounded bg-ink-800 px-1">LB_ADMIN_EMAILS</code> e não pode ser
          removido por aqui — é a porta de recuperação caso o acesso pelo banco se perca.
        </p>
      </Card>
    </div>
  );
}
