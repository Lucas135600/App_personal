"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "lb_install_dismissed";

/** Registra o service worker. Só em produção: em dev o Next troca os chunks a
 *  cada salvamento e um worker ativo deixa a tela velha na sua frente. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };

    // A hidratação costuma acontecer depois do "load"; nesse caso o listener
    // nunca dispararia e o worker jamais seria registrado.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

/** Faixa de instalação. No Android o próprio Chrome oferece o prompt nativo;
 *  no iOS não existe API de instalação, então resta instruir. */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      setIsIos(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* navegação privada: apenas não lembra da escolha */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    close();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-50 mx-auto w-full max-w-md px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-3 rounded-[18px] border border-lime-accent/40 bg-ink-850 p-3 shadow-lg shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-100">Instalar na tela inicial</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-400">
            {isIos
              ? "Toque em Compartilhar e depois em “Adicionar à Tela de Início”."
              : "Abre como aplicativo, sem a barra do navegador."}
          </p>
        </div>
        {!isIos && (
          <button
            onClick={install}
            className="shrink-0 rounded-xl bg-lime-accent px-3 py-2 text-xs font-bold text-ink-950"
          >
            Instalar
          </button>
        )}
        <button
          onClick={close}
          aria-label="Dispensar"
          className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-ink-500 hover:text-ink-200"
        >
          ×
        </button>
      </div>
    </div>
  );
}
