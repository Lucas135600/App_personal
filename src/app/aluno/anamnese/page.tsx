import { requireStudent } from "@/lib/auth";
import { getDb } from "@/lib/scope";
import { AnamnesisWizard } from "./wizard";

export default async function StudentAnamnesisPage() {
  const { student } = await requireStudent();
  const db = await getDb();
  const record = db.anamnesis.find((a) => a.studentId === student.id);

  return (
    <div className="space-y-5 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Anamnese</h1>
        <p className="mt-1 text-sm text-ink-400">
          Responda com calma. Estas informações definem a segurança e a direção do seu treino.
        </p>
      </header>

      <AnamnesisWizard answers={record?.answers ?? {}} answered={Boolean(record?.answeredAt)} />
    </div>
  );
}
