import { NextResponse } from "next/server";
import { syncAllClassPrompts } from "@/lib/class-prompts";

/* Varredura das aulas que já terminaram sem resposta.
 *
 * O painel do personal já faz isso quando ele abre o app; esta rota existe
 * para o dia em que ele NÃO abre — a notificação precisa estar lá esperando,
 * não ser criada só quando alguém lembra de olhar.
 *
 * Quem chama é o cron da hospedagem (vercel.json). A rota é pública por
 * endereço, então a chave é obrigatória: sem CRON_SECRET configurada ela se
 * recusa a rodar, em vez de ficar aberta para qualquer um disparar escrita.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurada." }, { status: 503 });
  }

  // A Vercel manda a chave neste cabeçalho. Fora dela, serve o mesmo formato.
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resultado = await syncAllClassPrompts();
  return NextResponse.json({ ok: true, ...resultado });
}
