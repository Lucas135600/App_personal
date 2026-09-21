"use client";

import { useRef, useState, useTransition } from "react";
import { uploadProgressPhotoAction } from "@/lib/actions/student";
import { Card, cx } from "@/components/ui";

const GUIDE: Record<string, string> = {
  frente: "De frente, braços ao lado do corpo, pés na largura do quadril.",
  lateral: "De lado, braços relaxados, olhando para frente.",
  costas: "De costas, mesma distância e mesma posição da foto de frente.",
};

const LABEL: Record<string, string> = {
  frente: "Frente",
  lateral: "Lateral",
  costas: "Costas",
};

const MAX_SIDE = 1280;
const QUALITY = 0.82;

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Reduz a foto no próprio celular antes de enviar.
 *  Uma foto de câmera tem de 3 a 8 MB; depois disso fica em torno de 300 KB,
 *  o que muda a ordem de grandeza do custo de storage e do tempo de upload.
 *  Se qualquer etapa falhar, envia o arquivo original. */
async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function PhotoUploader({
  month,
  slots,
}: {
  month: string;
  slots: Array<{ angle: string; fileName: string | null }>;
}) {
  const [error, setError] = useState("");
  const [savings, setSavings] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  function onPick(angle: string, file: File | undefined) {
    if (!file) return;
    setError("");
    setSavings("");
    setUploading(angle);

    startTransition(async () => {
      try {
        const optimized = await compressImage(file);
        if (optimized !== file) {
          setSavings(`${formatBytes(file.size)} -> ${formatBytes(optimized.size)}`);
        }

        const fd = new FormData();
        fd.set("month", month);
        fd.set("angle", angle);
        fd.set("photo", optimized);
        await uploadProgressPhotoAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
      } finally {
        setUploading(null);
      }
    });
  }

  return (
    <Card>
      <p className="text-sm text-ink-400">
        Use sempre a mesma roupa, o mesmo local e a mesma iluminação. A comparação fica muito mais
        honesta assim.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {slots.map((slot) => (
          <div key={slot.angle}>
            <button
              type="button"
              onClick={() => inputs.current[slot.angle]?.click()}
              disabled={pending}
              className={cx(
                "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border text-center transition-colors",
                slot.fileName
                  ? "border-lime-accent/40"
                  : "border-dashed border-ink-700 hover:border-ink-500",
                pending && "opacity-60",
              )}
            >
              {slot.fileName ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/foto/${slot.fileName}`}
                  alt={`Foto ${slot.angle}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-2 text-[11px] text-ink-500">
                  {uploading === slot.angle ? "enviando..." : "+ adicionar"}
                </span>
              )}
              {uploading === slot.angle && slot.fileName && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink-950/70 text-[11px] font-semibold">
                  enviando...
                </span>
              )}
            </button>
            <p className="mt-1.5 text-center text-xs font-semibold text-ink-200">{LABEL[slot.angle]}</p>
            <p className="mt-0.5 text-center text-[10px] leading-tight text-ink-500">{GUIDE[slot.angle]}</p>
            <input
              ref={(el) => {
                inputs.current[slot.angle] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                onPick(slot.angle, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        ))}
      </div>

      {savings && (
        <p className="mt-3 text-center text-[11px] text-ink-500">
          Foto otimizada no celular antes do envio: {savings}
        </p>
      )}
      {error && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}
