import { requireAdmin } from "@/lib/auth";
import { listSubscriptionPlans } from "@/lib/repo";
import { deletePlanAction } from "@/lib/actions/admin";
import { descontoPct, parcela, reais } from "@/lib/admin";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { PlanForm } from "./plan-form";

export default async function AdminPlansPage() {
  await requireAdmin();
  /* Inclui os inativos: escondê-los do administrador faria sumir um plano que
     ele mesmo desligou, e ele iria procurar onde o plano não está. */
  const planos = await listSubscriptionPlans(true);

  return (
    <div className="space-y-6 lb-enter">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Planos de assinatura</h1>
        <p className="mt-1 text-sm text-ink-400">
          O que você cadastra aqui é o que todo personal vê na aba Assinatura.
        </p>
      </header>

      <Card>
        <SectionTitle>Novo plano</SectionTitle>
        <PlanForm />
      </Card>

      {planos.length === 0 ? (
        <EmptyState
          title="Nenhum plano cadastrado"
          description="Use o formulário acima para criar o primeiro."
        />
      ) : (
        <div className="space-y-3">
          {planos.map((p) => {
            const off = descontoPct(p.priceCents, p.listPriceCents);
            return (
              <Card key={p.id}>
                <SectionTitle
                  action={
                    <span className="flex items-center gap-2">
                      {off > 0 && <Badge tone="accent">{off}% OFF</Badge>}
                      <Badge tone={p.active ? "ok" : "neutral"}>
                        {p.active ? "visível" : "oculto"}
                      </Badge>
                    </span>
                  }
                >
                  {p.name} — {reais(p.priceCents)}
                  {p.installments > 1 &&
                    ` (${p.installments}x ${reais(parcela(p.priceCents, p.installments))})`}
                </SectionTitle>
                <PlanForm plano={p} />
                <form action={deletePlanAction} className="mt-3 border-t border-ink-850 pt-3">
                  <input type="hidden" name="planId" value={p.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Excluir plano
                  </Button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
