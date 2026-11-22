// Línea base: los 12 modelos y las 5 formas (con y sin palitos) conservan su silueta de frente.
// `node pruebas/t-base.mjs --grabar` (solo con el código de partida) guarda la referencia.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, aplicarModeloId, huella, mismaHuella, disenoForma, FORMAS, ok, fin, RAIZ } from "./lib.mjs";
const GRABAR = process.argv.includes("--grabar");
const F = path.join(RAIZ, "pruebas/base/siluetas.json"), FB = path.join(RAIZ, "pruebas/base/boceto-viejo.json");
const { page, cerrar, errores } = await abrirApp();
const ids = await page.evaluate(() => MODELOS.map((m) => m.id));
const actual = {};
for (const id of ids){ await aplicarModeloId(page, id); actual["modelo:" + id] = await huella(page); }
for (const f of FORMAS) for (const pal of [true, false]){ await aplicar(page, disenoForma(f, pal)); actual["forma:" + f + (pal ? ":palitos" : ":sin")] = await huella(page); }
if (GRABAR){
  fs.writeFileSync(F, JSON.stringify(actual, null, 1));
  // boceto "viejo": como lo guarda el código de partida (palitos:true, relieve 1.2, con borde)
  await aplicarModeloId(page, ids[0]);
  await page.evaluate(() => { $("#bordeOn").checked = true; $("#relieve").value = "1.2"; refrescar(); });
  const diseno = await page.evaluate(() => estadoDiseno());
  fs.writeFileSync(FB, JSON.stringify({ diseno, huella: await huella(page) }, null, 1));
  console.log("grabadas " + Object.keys(actual).length + " siluetas + boceto viejo");
  await cerrar(); process.exit(0);
}
const base = JSON.parse(fs.readFileSync(F, "utf8"));
// La altura del relieve de los modelos cambia en la Entrega 2 (1,2 -> 1,0); la silueta 2D no depende de ella.
for (const k of Object.keys(base)) ok(actual[k] && mismaHuella(actual[k], base[k]), "silueta igual a la base: " + k);
if (errores.length) console.log("errores de página:", errores.slice(0, 3));
await cerrar(); fin();
