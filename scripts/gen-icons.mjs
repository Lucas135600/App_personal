import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/* Gera os icones do app a partir do codigo, sem dependencia de imagem.
   Roda com: npm run icons
   O encoder PNG e o mesmo de src/lib/placeholder-photo.ts, duplicado aqui
   porque este script e .mjs e nao passa pelo TypeScript. */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** PNG RGBA (colorType 6), para os cantos transparentes do icone. */
function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const LIME = [200, 245, 66];
const INK = [8, 9, 10];

function roundedRect(x, y, w, h, r) {
  return (px, py) => {
    if (px < x || py < y || px > x + w || py > y + h) return false;
    const dx = Math.min(Math.max(px, x + r), x + w - r);
    const dy = Math.min(Math.max(py, y + r), y + h - r);
    const ex = px - dx;
    const ey = py - dy;
    return ex * ex + ey * ey <= r * r;
  };
}

/** Traco grosso de ponta arredondada: distancia do ponto ao segmento.
 *  Equivale a stroke-linecap/linejoin "round" do SVG. */
function segment(x1, y1, x2, y2, halfW) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  return (px, py) => {
    let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    return (px - qx) ** 2 + (py - qy) ** 2 <= halfW * halfW;
  };
}

/* A marca em unidades de projeto, igual ao SVG de src/components/logo.tsx.
   MARK e a caixa util do desenho; o renderizador encaixa essa caixa no icone. */
const MARK = { x: 33, y: 27, w: 94, h: 91 };

const MARK_SHAPES = [
  // arco de progresso — ponto mais baixo em y=70, com folga ate a anilha (y=86)
  segment(50, 70, 70, 52, 5.5),
  segment(70, 52, 88, 64, 5.5),
  segment(88, 64, 120, 34, 5.5),
  // ponta da seta
  segment(120, 34, 120, 52, 5.5),
  segment(120, 34, 102, 34, 5.5),
  // halter
  roundedRect(58, 96, 44, 11, 5),
  roundedRect(46, 86, 12, 31, 5),
  roundedRect(102, 86, 12, 31, 5),
  roundedRect(34, 93, 9, 17, 4),
  roundedRect(117, 93, 9, 17, 4),
];

/** Encaixa a marca na caixa de conteudo informada. */
function markMask(boxX, boxY, boxW, boxH) {
  const scale = boxW / MARK.w;
  return (px, py) => {
    const dx = MARK.x + (px - boxX) / scale;
    const dy = MARK.y + (py - boxY) / (boxH / MARK.h);
    for (const shape of MARK_SHAPES) if (shape(dx, dy)) return true;
    return false;
  };
}

/**
 * @param size      lado em pixels
 * @param inset     margem do conteudo (0..0.5) — maior para icone maskable
 * @param corner    raio do canto em fracao do lado (0 = quadrado, para o iOS)
 */
function renderIcon(size, inset, corner) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = roundedRect(0, 0, size - 1, size - 1, corner * size);

  const pad = size * inset;
  const boxW = size - pad * 2;
  const boxH = boxW * (MARK.h / MARK.w); // mantem a proporcao do desenho
  const letters = markMask(pad, (size - boxH) / 2, boxW, boxH);

  const SS = 3; // supersampling, para a borda nao ficar serrilhada
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inBg = 0;
      let inInk = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (bg(px, py)) inBg++;
          if (letters(px, py)) inInk++;
        }
      }
      const total = SS * SS;
      const aBg = inBg / total;
      const aInk = (inInk / total) * aBg;

      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(LIME[c] * (1 - aInk) + INK[c] * aInk);
      }
      rgba[i + 3] = Math.round(255 * aBg);
    }
  }
  return encodePng(size, rgba);
}

const OUT = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { file: "icon-192.png", size: 192, inset: 0.16, corner: 0.22 },
  { file: "icon-512.png", size: 512, inset: 0.16, corner: 0.22 },
  // maskable: o Android recorta ate 20% de cada borda, entao o conteudo recua
  { file: "icon-maskable-512.png", size: 512, inset: 0.32, corner: 0 },
  // o iOS aplica o proprio arredondamento, entao o quadrado vai inteiro
  { file: "apple-touch-icon.png", size: 180, inset: 0.16, corner: 0 },
];

for (const t of TARGETS) {
  fs.writeFileSync(path.join(OUT, t.file), renderIcon(t.size, t.inset, t.corner));
  console.log(`public/icons/${t.file}`);
}

fs.writeFileSync(
  path.join(process.cwd(), "src", "app", "icon.png"),
  renderIcon(64, 0.1, 0.22),
);
console.log("src/app/icon.png (favicon)");
