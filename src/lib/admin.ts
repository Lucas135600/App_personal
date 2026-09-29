import type { User } from "./types";

/* Quem é administrador do aplicativo.
 *
 * Duas fontes, e as duas existem por um motivo:
 *
 * 1. LB_ADMIN_EMAILS, na hospedagem. Resolve o problema do arranque: sem ela,
 *    o primeiro administrador precisaria de alguém já administrador para
 *    liberá-lo, e não há esse alguém. Também é a saída se a marca no banco for
 *    perdida por engano — quem controla a hospedagem recupera o acesso.
 *
 * 2. users.is_admin, no banco. É como o dono libera um sócio, pela tela,
 *    sem republicar o aplicativo.
 *
 * A comparação é por e-mail em minúsculas e sem espaços: e-mail digitado em
 * campo de configuração vem com maiúscula e espaço sobrando o tempo todo.
 */

function listaDoAmbiente(): string[] {
  return (process.env.LB_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user: Pick<User, "email" | "isAdmin"> | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return listaDoAmbiente().includes(user.email.trim().toLowerCase());
}

/** Administrador que veio da hospedagem não pode ser removido pela tela —
 *  a tela não alcança a variável de ambiente, e fingir que removeu seria
 *  pior do que dizer que não dá. */
export function adminDoAmbiente(email: string): boolean {
  return listaDoAmbiente().includes(email.trim().toLowerCase());
}

/* ------------------------------------------------------------- dinheiro */

/** Centavos para "R$ 39,90". Formata sempre com dois dígitos: 3990 vira
 *  "R$ 39,90" e não "R$ 39,9". */
export function reais(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/** Percentual de desconto, arredondado. 0 quando não há preço "de". */
export function descontoPct(priceCents: number, listPriceCents: number): number {
  if (listPriceCents <= 0 || listPriceCents <= priceCents) return 0;
  return Math.round((1 - priceCents / listPriceCents) * 100);
}

/** Valor de cada parcela. A divisão é feita em centavos e arredondada uma
 *  única vez, para a soma das parcelas não fugir do total exibido. */
export function parcela(priceCents: number, installments: number): number {
  if (installments <= 1) return priceCents;
  return Math.round(priceCents / installments);
}
