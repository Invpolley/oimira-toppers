// ok/fin para pruebas que no necesitan navegador.
import path from "node:path"; import { fileURLToPath } from "node:url";
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let total = 0, fallas = 0;
export function ok(cond, nombre){ total++; if (!cond){ fallas++; console.log("  ✗ " + nombre); } return !!cond; }
export function fin(){
  if (fallas){ console.log(fallas + " de " + total + " comprobaciones FALLARON"); process.exit(1); }
  console.log(total + " comprobaciones OK"); process.exit(0);
}
