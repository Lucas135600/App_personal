"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { adminDoAmbiente } from "@/lib/admin";
import * as repo from "@/lib/repo-write";

/* Ações da administração. Toda uma delas começa por requireAdmin(): a tela
   já está atrás do portão, mas a tela não é a guarda — um envio montado à
   mão chega direto na ação. */

function str(v: FormDataEntryValue | null) {
  return String(v ?? "").trim();
}

/** "39,90" e "39.90" viram 3990. Dinheiro entra por texto e sai inteiro. */
function centavos(v: FormDataEntryValue | null): number {
  const t = str(v).replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return -1;
  return Math.round(n * 100);
}

export interface PlanoState {
  error?: string;
  ok?: string;
}

export async function savePlanAction(
  _prev: PlanoState,
  formData: FormData,
): Promise<PlanoState> {
  await requireAdmin();

  const name = str(formData.get("name"));
  const months = Number(str(formData.get("months")));
  const price = centavos(formData.get("price"));
  const list = str(formData.get("listPrice")) ? centavos(formData.get("listPrice")) : 0;
  const installments = Number(str(formData.get("installments"))) || 1;

  if (!name) return { error: "Dê um nome ao plano." };
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    return { error: "Duração em meses inválida." };
  }
  if (price < 0) return { error: "Preço inválido." };
  if (list < 0) return { error: "Preço \"de\" inválido." };
  if (list > 0 && list <= price) {
    return { error: "O preço \"de\" precisa ser maior que o preço cobrado, senão não há desconto." };
  }
  if (installments < 1 || installments > 24) return { error: "Parcelas entre 1 e 24." };

  try {
    await repo.upsertPlan(str(formData.get("planId")) || null, {
      name,
      months,
      priceCents: price,
      listPriceCents: list,
      installments,
      description: str(formData.get("description")),
      orderIndex: Number(str(formData.get("orderIndex"))) || months,
      active: formData.get("active") === "on",
    });
  } catch (e) {
    console.error("savePlanAction", e);
    return { error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }

  revalidatePath("/admin/planos");
  revalidatePath("/app/assinatura");
  return { ok: "Plano salvo." };
}

export async function deletePlanAction(formData: FormData) {
  await requireAdmin();
  await repo.deletePlan(str(formData.get("planId")));
  revalidatePath("/admin/planos");
  revalidatePath("/app/assinatura");
}

export interface SocioState {
  error?: string;
  ok?: string;
}

export async function setAdminAction(
  _prev: SocioState,
  formData: FormData,
): Promise<SocioState> {
  const eu = await requireAdmin();
  const email = str(formData.get("email")).toLowerCase();
  const liberar = str(formData.get("acao")) === "liberar";

  if (!email) return { error: "Informe o e-mail." };

  /* Duas travas que evitam ficar sem administrador nenhum. */
  if (!liberar && email === eu.email.toLowerCase()) {
    return { error: "Você não pode remover o seu próprio acesso." };
  }
  if (!liberar && adminDoAmbiente(email)) {
    return {
      error:
        "Este acesso vem da configuração da hospedagem, não do banco. " +
        "Para removê-lo, tire o e-mail de LB_ADMIN_EMAILS.",
    };
  }

  let id: string | null;
  try {
    id = await repo.setAdminByEmail(email, liberar);
  } catch (e) {
    console.error("setAdminAction", e);
    return { error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }

  // Liberar quem ainda não tem conta daria a impressão de ter funcionado.
  if (!id) return { error: "Não existe conta com esse e-mail. A pessoa precisa se cadastrar antes." };

  revalidatePath("/admin/socios");
  return { ok: liberar ? "Sócio liberado." : "Acesso removido." };
}
