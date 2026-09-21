import zlib from "node:zlib";

/* Gera silhuetas sintéticas em PNG para os dados de demonstração.
   Não são fotos de pessoas: e uma figura desenhada por código, só para que a
   tela de comparação tenha conteúdo antes de existir foto real. */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Codifica RGB cru (width*height*3) em PNG truecolor. */
function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const W = 480;
const H = 640;

/** Largura em pontos-chave interpolados linearmente. */
function profile(points: Array<[number, number]>, y: number): number {
  if (y <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [y0, w0] = points[i - 1];
    const [y1, w1] = points[i];
    if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
  }
  return points[points.length - 1][1];
}

export interface Silhouette {
  /** 0 = início do acompanhamento, 1 = mais recente. */
  progress: number;
  angle: "frente" | "lateral" | "costas";
  /** Variação leve por aluno para as figuras não ficarem idênticas. */
  build: number;
}

function buildMask({ progress, angle, build }: Silhouette): Uint8Array {
  const mask = new Uint8Array(W * H);
  const cx = W / 2;

  const shoulder = (92 + build * 10 + progress * 7) * (angle === "lateral" ? 0.52 : 1);
  const waist = (76 + build * 8 - progress * 15) * (angle === "lateral" ? 0.74 : 1);
  const hip = (84 + build * 6 - progress * 5) * (angle === "lateral" ? 0.8 : 1);

  const torso: Array<[number, number]> = [
    [120, shoulder * 0.8],
    [150, shoulder],
    [235, waist * 1.06],
    [285, waist],
    [330, hip * 0.99],
    [372, hip * 0.92],
  ];

  // Na vista lateral a barriga avança para a frente e recua com o progresso.
  const bellyFront = 34 + build * 6 - progress * 16;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let inside = false;

      // cabeça
      const dxh = x - cx;
      const dyh = y - 78;
      if (dxh * dxh / (34 * 34) + dyh * dyh / (42 * 42) <= 1) inside = true;

      // pescoço
      if (y >= 108 && y <= 128 && Math.abs(x - cx) <= 18) inside = true;

      // tronco
      if (y >= 118 && y <= 375) {
        const half = profile(torso, y);
        if (angle === "lateral") {
          const front = y >= 250 && y <= 330 ? half + bellyFront * (1 - Math.abs(y - 292) / 44) : half * 0.9;
          if (x >= cx - half && x <= cx + front) inside = true;
        } else if (Math.abs(x - cx) <= half) {
          inside = true;
        }
      }

      // pernas
      if (y >= 360 && y <= 600) {
        const t = (y - 360) / 240;
        const legHalf = (hip * 0.4 - t * (hip * 0.4 - 19)) * (angle === "lateral" ? 1.2 : 1);
        if (angle === "lateral") {
          if (Math.abs(x - (cx + 4 - t * 10)) <= legHalf) inside = true;
        } else {
          const offset = hip * 0.5 * (1 - t * 0.22);
          if (Math.abs(x - (cx - offset)) <= legHalf || Math.abs(x - (cx + offset)) <= legHalf) {
            inside = true;
          }
        }
      }

      // braços
      if (y >= 140 && y <= 400) {
        const t = (y - 140) / 260;
        const armHalf = 20 - t * 6;
        if (angle === "lateral") {
          if (Math.abs(x - (cx + 6 + t * 6)) <= armHalf) inside = true;
        } else {
          const off = shoulder - 2 + t * 12;
          if (Math.abs(x - (cx - off)) <= armHalf || Math.abs(x - (cx + off)) <= armHalf) inside = true;
        }
      }

      if (inside) mask[y * W + x] = 1;
    }
  }

  return mask;
}

export function renderSilhouettePng(spec: Silhouette): Buffer {
  const mask = buildMask(spec);
  const rgb = Buffer.alloc(W * H * 3);

  for (let y = 0; y < H; y++) {
    // fundo com leve gradiente vertical
    const g = 16 + Math.round((y / H) * 10);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const on = mask[y * W + x] === 1;

      if (!on) {
        rgb[i] = g;
        rgb[i + 1] = g + 1;
        rgb[i + 2] = g + 3;
        continue;
      }

      // luz de contorno na borda esquerda, no verde da marca
      const rim = x > 3 && mask[y * W + (x - 4)] === 0;
      if (rim) {
        rgb[i] = 200;
        rgb[i + 1] = 245;
        rgb[i + 2] = 66;
      } else {
        const shade = 54 + Math.round(((x / W) * 18));
        rgb[i] = shade;
        rgb[i + 1] = shade + 4;
        rgb[i + 2] = shade + 10;
      }
    }
  }

  return encodePng(W, H, rgb);
}
