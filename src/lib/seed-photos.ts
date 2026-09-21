import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "./paths";
import { renderSilhouettePng, type Silhouette } from "./placeholder-photo";
import { addMonths, currentMonth } from "./dates";
import type { ProgressPhoto } from "./types";

const ANGLES: Array<Silhouette["angle"]> = ["frente", "lateral", "costas"];

export interface PhotoSeedInput {
  studentId: string;
  /** Quantos meses para trás começar; 0 inclui o mês corrente. */
  monthsBack: number[];
  build: number;
}

/** Cria as silhuetas de demonstração em disco e devolve os registros. */
export function seedProgressPhotos(inputs: PhotoSeedInput[]): ProgressPhoto[] {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const photos: ProgressPhoto[] = [];
  const base = currentMonth();

  for (const input of inputs) {
    const total = input.monthsBack.length;
    input.monthsBack.forEach((back, index) => {
      const month = addMonths(base, -back);
      const progress = total > 1 ? index / (total - 1) : 1;

      for (const angle of ANGLES) {
        const fileName = `${input.studentId}_${month}_${angle}_seed.png`;
        const target = path.join(UPLOADS_DIR, fileName);
        if (!fs.existsSync(target)) {
          fs.writeFileSync(target, renderSilhouettePng({ progress, angle, build: input.build }));
        }
        photos.push({
          id: `pht_${input.studentId}_${month}_${angle}`,
          studentId: input.studentId,
          month,
          angle,
          fileName,
          createdAt: `${month}-05T09:00:00`,
        });
      }
    });
  }

  return photos;
}
