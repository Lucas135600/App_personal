import Link from "next/link";
import { requirePersonal } from "@/lib/auth";
import { listSubscriptionPlans } from "@/lib/repo";
import { descontoPct, isAdmin, parcela, reais } from "@/lib/admin";
import { Card, EmptyState } from "@/components/ui";

export default async function SubscriptionPage() {
  const user = await requirePersonal();
  const planos = await listSubscriptionPlans();
  const admin = isAdmin(user);

  return (
    <div className="mx-auto max-w-2xl space-y-6 lb-enter">
      <header>
        <h1 className="text-3xl font-light tracking-tight text-ink-300">Alunos</h1>
        <p className="-mt-1 text-3xl font-extrabold tracking-tight text-ink-100">Ilimitados</p>
        <div className="mt-4 h-px w-40 bg-ink-800" />
      </header>

      {planos.length === 0 ? (
        <EmptyState
          title="Nenhum plano publicado"
          description={
            admin
              ? "Cadastre os planos na área de administração para que eles apareçam aqui."
              : "Os planos ainda não foram publicados. Fale com o responsável pelo aplicativo."
          }
        />
      ) : (
        <div className="space-y-3">
          {planos.map((p) => {
            const off = descontoPct(p.priceCents, p.listPriceCents);
            return (
              <Card key={p.id} padded={false}>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    {off > 0 && (
                      <span className="mb-2 inline-block rounded-full bg-lime-accent/15 px-2.5 py-1 text-[11px] font-bold text-lime-accent">
                        {off}% OFF
                      </span>
                    )}
                    <p className="text-xl font-bold text-ink-100">{p.name}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    {off > 0 && (
                      <p className="text-sm text-ink-500 line-through">{reais(p.listPriceCents)}</p>
                    )}
                    <p className="text-2xl font-extrabold tracking-tight text-ink-100">
                      {reais(p.priceCents)}
                    </p>
                    <p className="text-xs text-ink-400">
                      {p.months === 1
                        ? "por mês"
                        : p.installments > 1
                          ? `ou ${p.installments}x ${reais(parcela(p.priceCents, p.installments))}`
                          : "à vista"}
                    </p>
                  </div>
                </div>

                <p className="border-t border-ink-850 px-5 py-3 text-center text-xs text-ink-400">
                  {p.description || `${p.name} de assinatura com alunos ilimitados`}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dizer o que a tela NÃO faz evita a pergunta "cliquei e não cobrou". */}
      <p className="text-center text-[11px] leading-relaxed text-ink-600">
        Esta tela mostra os valores vigentes. A contratação e o pagamento são tratados
        fora do aplicativo, direto com o responsável.
      </p>

      {admin && (
        <div className="text-center">
          <Link href="/admin/planos" className="text-sm font-semibold text-lime-accent">
            Editar planos
          </Link>
        </div>
      )}
    </div>
  );
}
