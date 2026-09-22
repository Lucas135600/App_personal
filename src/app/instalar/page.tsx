import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Instalar o app — Vision Fitness",
  description: "Coloque o Vision Fitness na tela inicial do seu celular.",
};

const ANDROID = [
  "Abra este link no Chrome.",
  "Toque nos três pontinhos, no canto superior direito.",
  "Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.",
  "Confirme. O ícone da LB aparece junto dos seus outros apps.",
];

const IOS = [
  "Abra este link no Safari (não funciona pelo Chrome no iPhone).",
  "Toque no botão Compartilhar, o quadradinho com a seta para cima.",
  "Role a lista e escolha “Adicionar à Tela de Início”.",
  "Toque em Adicionar. Pronto, o ícone fica na sua tela.",
];

export default function InstallPage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10 lb-enter">
      <div className="text-center">
        <Logo size="lg" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Instale o app no seu celular</h1>
        <p className="mt-2 text-sm text-ink-400">
          Não precisa baixar nada na loja. Em menos de um minuto o LB fica na sua tela inicial,
          com ícone próprio e abrindo em tela cheia.
        </p>
      </div>

      <Card className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-accent">
          Android
        </h2>
        <ol className="mt-3 space-y-2.5">
          {ANDROID.map((step, i) => (
            <Step key={step} n={i + 1} text={step} />
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-accent">
          iPhone
        </h2>
        <ol className="mt-3 space-y-2.5">
          {IOS.map((step, i) => (
            <Step key={step} n={i + 1} text={step} />
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <p className="text-sm text-ink-400">
          Seu treino, seu check-in e suas fotos ficam guardados na sua conta, não no aparelho. Você
          pode entrar de qualquer celular com o mesmo e-mail e senha.
        </p>
      </Card>

      <LinkButton href="/login" size="lg" className="mt-6">
        Entrar na minha conta
      </LinkButton>

      <p className="mt-6 text-center text-xs text-ink-600">
        Problemas para instalar?{" "}
        <Link href="/login" className="text-ink-400 underline">
          fale com o Lucas
        </Link>
      </p>
    </main>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-800 text-[11px] font-bold text-ink-300">
        {n}
      </span>
      <span className="text-sm leading-relaxed text-ink-200">{text}</span>
    </li>
  );
}
