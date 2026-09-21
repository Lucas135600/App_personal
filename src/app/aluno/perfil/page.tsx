import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildStudentView } from "@/lib/queries";
import { logoutAction } from "@/lib/actions/auth";
import { formatDate, WEEKDAY_LABELS } from "@/lib/dates";
import { Avatar, Badge, Button, Card, SectionTitle } from "@/components/ui";
import { MODALITY_LABEL } from "@/lib/labels";

export default async function StudentProfilePage() {
  const { user, student } = await requireStudent();
  const view = buildStudentView(student.id)!;
  const db = getDb();
  const coach = db.users.find((u) => u.id === student.professionalId);
  const anamnesis = db.anamnesis.find((a) => a.studentId === student.id);
  const notifications = db.notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-5 lb-enter">
      <header className="flex items-center gap-4">
        <Avatar name={user.name} color={user.avatarColor} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-ink-400">{user.email}</p>
        </div>
      </header>

      <Card>
        <SectionTitle>Seu plano</SectionTitle>
        <dl className="space-y-2 text-sm">
          <Row label="Objetivo" value={student.goal} />
          <Row label="Modalidade" value={MODALITY_LABEL[student.modality]} />
          <Row label="Aluno desde" value={formatDate(student.startDate)} />
          <Row label="Dias de treino" value={student.trainingDays.map((d) => WEEKDAY_LABELS[d]).join(" / ") || "--"} />
          <Row label="Personal" value={coach?.name ?? "--"} />
        </dl>
      </Card>

      <Card>
        <SectionTitle
          action={
            <Badge tone={anamnesis?.answeredAt ? "ok" : "warn"}>
              {anamnesis?.answeredAt ? "respondida" : "pendente"}
            </Badge>
          }
        >
          Anamnese
        </SectionTitle>
        <p className="text-sm text-ink-400">
          {anamnesis?.answeredAt
            ? `Atualizada em ${formatDate(anamnesis.answeredAt)}.`
            : "Responda para o Lucas ajustar seu treino com segurança."}
        </p>
        <Link
          href="/aluno/anamnese"
          className="mt-3 inline-flex rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-ink-100"
        >
          {anamnesis?.answeredAt ? "Revisar respostas" : "Responder agora"}
        </Link>
      </Card>

      <Card>
        <SectionTitle>Seus números</SectionTitle>
        <dl className="space-y-2 text-sm">
          <Row label="Adesão geral" value={`${view.adherence.overall}%`} />
          <Row label="Frequência" value={`${view.frequency}%`} />
          <Row label="Treinos (4 semanas)" value={`${view.doneLast4Weeks}`} />
          <Row label="Última avaliação" value={view.lastAssessment ? formatDate(view.lastAssessment.date) : "--"} />
        </dl>
      </Card>

      <Card>
        <SectionTitle>Avisos</SectionTitle>
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-500">Nenhum aviso.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-xl bg-ink-850 px-3 py-2.5">
                <p className="text-sm font-semibold text-ink-100">{n.title}</p>
                <p className="mt-0.5 text-xs text-ink-400">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Privacidade</SectionTitle>
        <p className="text-sm text-ink-400">
          Seus dados de saúde e suas fotos de evolução são visíveis apenas para você e para o seu
          personal. Cada acesso às imagens exige autenticação.
        </p>
      </Card>

      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="lg">
          Sair da conta
        </Button>
      </form>
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
