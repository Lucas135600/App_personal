import fs from "node:fs";
import path from "node:path";

/** Apaga a base local e os uploads. O seed e recriado no proximo acesso. */
const dataDir = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  console.log("Nada para apagar: a pasta data/ ainda nao existe.");
  process.exit(0);
}

fs.rmSync(dataDir, { recursive: true, force: true });
console.log("Base local apagada. Rode 'npm run dev' e o seed sera recriado.");
