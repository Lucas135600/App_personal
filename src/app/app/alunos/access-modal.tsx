"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

export interface Acesso {
  studentId: string;
  nome: string;
  email: string;
  senha: string;
  telefone: string;
}

/** Só dígitos, com o 55 na frente quando o número veio sem código de país. */
function paraWhatsapp(tel: string): string | null {
  const d = tel.replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

/* Mostra a senha uma única vez.
 *
 * A senha em texto puro existe só nesta resposta do servidor: o banco guarda
 * apenas o hash. Se a tela fechar sem que o personal copie, não há de onde
 * recuperar — só gerar outra. Por isso o botão de fechar avisa. */
export function AccessModal({ acesso, onClose }: { acesso: Acesso; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const endereco = typeof window === "undefined" ? "" : window.location.origin;
  const texto =
    `Olá, ${acesso.nome.split(" ")[0]}! Seu acesso à Vision Fitness:\n\n` +
    `${endereco}\n\n` +
    `Login: ${acesso.email}\n` +
    `Senha: ${acesso.senha}\n\n` +
    `No primeiro acesso você escolhe a sua própria senha.`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // clipboard bloqueado (http, permissão negada): o texto está na tela
      setCopiado(false);
    }
  }

  const zap = paraWhatsapp(acesso.telefone);

  /* Vai para o body por portal, e o motivo é concreto: a animação de entrada
     das telas usa `animation: ... both`, que deixa um transform no elemento
     mesmo depois de terminar. Um ancestral com transform vira bloco de
     contenção e faz `position: fixed` se comportar como `absolute` — o aviso
     nascia deslocado e rolava junto com a página em vez de cobrir a tela. */
  if (!montado) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acesso-titulo"
    >
      <div className="w-full max-w-sm rounded-[22px] border border-ink-800 bg-ink-900 p-6">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-lime-accent/15">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21 3-9.5 9.5" />
            <path d="M21 3 14.5 21l-3-7.5L4 10.5 21 3Z" />
          </svg>
        </div>

        <h2 id="acesso-titulo" className="mt-4 text-center text-base font-bold text-ink-100">
          Envie estas informações para {acesso.nome.split(" ")[0]}
        </h2>

        <dl className="mt-4 space-y-1 rounded-xl bg-ink-850 p-4 text-center">
          <div>
            <dt className="inline text-sm text-ink-400">Login: </dt>
            <dd className="inline break-all text-sm font-semibold text-ink-100">{acesso.email}</dd>
          </div>
          <div>
            <dt className="inline text-sm text-ink-400">Senha: </dt>
            <dd className="inline select-all font-mono text-lg font-bold tracking-[0.15em] text-lime-accent">
              {acesso.senha}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-500">
          Esta senha aparece só agora. Ela vale para o primeiro acesso — o aluno
          escolhe a dele em seguida, e nem você nem eu conseguimos vê-la depois.
        </p>

        <div className="mt-5 space-y-2">
          {zap ? (
            <a
              href={`https://wa.me/${zap}?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-[#08290f]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.3-1-2.6s.6-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.3.3c-.1.1-.2.3 0 .5.1.2.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.7-.8c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.5.3.1.2.1.7-.1 1.3Z" />
              </svg>
              Enviar via WhatsApp
            </a>
          ) : (
            <p className="rounded-xl bg-ink-850 px-3 py-2 text-center text-[11px] text-ink-500">
              Sem telefone cadastrado — copie e envie do jeito que preferir.
            </p>
          )}

          <Button type="button" variant="outline" onClick={copiar} className="w-full">
            {copiado ? "Copiado" : "Copiar"}
          </Button>

          <Button autoFocus type="button" variant="ghost" onClick={onClose} className="w-full">
            Já enviei, fechar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
