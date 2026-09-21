import { requirePersonal } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { Avatar, Card, SectionTitle } from "@/components/ui";
import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const pro = await requirePersonal();
  const db = await getDb();
  const alunos = db.students.filter((s) => s.professionalId === pro.id).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 lb-enter">
      <header className="flex items-center gap-4">
        <Avatar name={pro.name} color={pro.avatarColor} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{pro.name}</h1>
          <p className="text-sm text-ink-400">{pro.email}</p>
        </div>
      </header>

      <Card>
        <SectionTitle>Dados de acesso</SectionTitle>
        <p className="mb-4 text-sm text-ink-400">
          O e-mail aqui é o que você usa para entrar na plataforma. Trocá-lo não altera nada do lado
          dos alunos.
        </p>
        <AccountForm name={pro.name} email={pro.email} />
      </Card>

      <Card>
        <SectionTitle>Sua conta</SectionTitle>
        <dl className="space-y-2 text-sm">
          <Row label="Perfil" value="Personal trainer" />
          <Row label="Alunos ativos" value={String(alunos)} />
          <Row label="Conta criada em" value={formatDate(pro.createdAt)} />
        </dl>
      </Card>

      <Card>
        <SectionTitle>Aviso por e-mail</SectionTitle>
        <p className="text-sm text-ink-400">
          A plataforma ainda não envia e-mail. As atualizações dos alunos chegam na{" "}
          <span className="font-semibold text-ink-200">central de avisos</span>, dentro do app.
          O envio por e-mail depende de um provedor de disparo e de a plataforma estar hospedada,
          porque só sai mensagem com o servidor no ar.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-850 pb-2 last:border-0 last:pb-0">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right font-semibold text-ink-100">{value}</dd>
    </div>
  );
}
