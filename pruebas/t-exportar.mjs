// La descarga 3MF es un proyecto Bambu con filamento por parte; el resumen cuenta filamentos (colores distintos).
// Uso: node pruebas/t-exportar.mjs [--guardar <ruta.3mf>]  (guarda el 3MF del diseño "Feliz Cumpleaños" para laminarlo)
import fs from "node:fs";
import { abrirApp, aplicar, aplicarModeloId, disenoForma, ok, fin } from "./lib.mjs";
const iG = process.argv.indexOf("--guardar"), GUARDAR = iG > 0 ? process.argv[iG + 1] : null;
// TP_URL=https://… corre la misma prueba contra el sitio publicado
const { page, cerrar, errores } = await abrirApp(process.env.TP_URL ? { url: process.env.TP_URL } : undefined);
const leer3mf = () => page.evaluate(async () => {
  const blob = await construir3mf(), zip = await JSZip.loadAsync(blob);
  if (!zip.file("Metadata/project_settings.config")) return { partes: [], esperadas: -1, colores: [], titulo: null };
  const ms = new DOMParser().parseFromString(await zip.file("Metadata/model_settings.config").async("string"), "application/xml");
  const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
  const ps = JSON.parse(await zip.file("Metadata/project_settings.config").async("string"));
  const partes = Array.from(ms.getElementsByTagName("part")).map((p) => ({ nombre: meta(p, "name"), ext: +meta(p, "extruder") }));
  const esperadas = GEOS.piezas.length; // una parte por pieza de impresión
  return { partes, esperadas, colores: ps.filament_colour, titulo: meta(ms.getElementsByTagName("object")[0], "name"), b64: null };
});
const resumen = async () => { await page.evaluate(() => abrirExportar()); return page.evaluate(() => ({ html: document.getElementById("expResumen").innerHTML, txt: document.getElementById("expResumen").textContent, muestras: document.querySelectorAll("#expResumen .pal")[0].querySelectorAll("i").length, fuera: document.querySelectorAll("#expResumen .pal").length > 1 ? document.querySelectorAll("#expResumen .pal")[1].querySelectorAll("i").length : 0 })); };

// --- modelo 1: texto y figura comparten color -> 3 filamentos para 4 partes
const ids = await page.evaluate(() => MODELOS.map((m) => m.id));
await aplicarModeloId(page, ids[0]);
let r = await leer3mf();
ok(r.partes.length === r.esperadas && r.partes.length === 4, "modelo 1: una parte por pieza visible (" + r.partes.length + "/" + r.esperadas + ")");
ok(JSON.stringify(r.partes.map((p) => p.nombre)) === JSON.stringify(["Placa", "Texto", "Figura", "Adorno"]), "nombres: " + r.partes.map((p) => p.nombre).join(","));
ok(JSON.stringify(r.colores) === JSON.stringify(["#FDF6EE", "#B44F61", "#D9A066"]), "filamentos = colores distintos, placa primero: " + r.colores.join(","));
ok(JSON.stringify(r.partes.map((p) => p.ext)) === JSON.stringify([1, 2, 2, 3]), "texto y figura comparten filamento: " + r.partes.map((p) => p.ext).join(","));
ok(r.titulo === "topper-mis-15", "título del proyecto: " + r.titulo);
let s = await resumen();
ok(/3 filamentos/.test(s.txt) && s.muestras === 3, "resumen: 3 filamentos y 3 muestras de color (" + s.muestras + ")");
ok(/no está en tus filamentos/i.test(s.txt) && s.fuera === 3, "avisa que hay colores fuera de la paleta de la tienda");

// --- figura PRO en capas: cada capa es una parte; colores repetidos comparten filamento
const pro = await page.evaluate(() => { const m = (window.MOTIVOS_PRO || []).filter((x) => x.capas && x.capas.length > 1)[0]; return m ? m.nombre : null; });
if (ok(!!pro, "hay una figura PRO para probar")){
  await aplicar(page, disenoForma("contorno", true, { raiz: { motivo: await page.evaluate((n) => buscarMotivo(n), pro) } }));
  r = await leer3mf();
  const capas = await page.evaluate(() => GEOS.motivoCapas.map((c) => c.color));
  const nCapas = r.partes.filter((p) => /^Figura capa \d+$/.test(p.nombre)).length;
  ok(r.partes.length === r.esperadas && nCapas >= 2 && nCapas <= capas.length, "PRO: una parte por capa que se ve (" + nCapas + " de " + capas.length + ")");
  const coloresPiezas = await page.evaluate(() => Array.from(new Set(GEOS.piezas.map((p) => p.color.toLowerCase()))).length);
  ok(r.colores.length === coloresPiezas && r.colores.length <= new Set(["#f5f5f5", "#d32f2f"].concat(capas).map((c) => c.toLowerCase())).size, "PRO: filamentos = colores distintos que se ven (" + r.colores.length + ")");
  ok(r.partes.every((p) => p.ext >= 1 && p.ext <= r.colores.length), "PRO: todo filamento existe en la lista");
}

// --- colores de la paleta de la tienda: sin aviso; un solo color -> 1 filamento
await aplicar(page, disenoForma("ovalo", true));
s = await resumen();
ok(/2 filamentos/.test(s.txt) && !/no está en tus filamentos/i.test(s.txt), "paleta de la tienda: 2 filamentos, sin aviso");
await aplicar(page, disenoForma("ovalo", true, { campos: { c2: "#F5F5F5" } }));
r = await leer3mf(); s = await resumen();
ok(r.colores.length === 1 && r.partes.every((p) => p.ext === 1) && /1 filamento(?!s)/.test(s.txt), "todo del mismo color: 1 filamento");

// --- botones: 3MF y ZIP de STL siguen descargando
await aplicar(page, disenoForma("contorno", true));
await page.evaluate(() => abrirExportar());
let [d1] = await Promise.all([page.waitForEvent("download"), page.click("#btn3mf")]);
ok(/^topper-feliz\.3mf$/.test(d1.suggestedFilename()), "botón 3MF descarga " + d1.suggestedFilename());
if (GUARDAR){ await d1.saveAs(GUARDAR); console.log("guardado " + GUARDAR + " (" + fs.statSync(GUARDAR).size + " bytes)"); }
let [d2] = await Promise.all([page.waitForEvent("download"), page.click("#btnStl")]);
ok(/-stl\.zip$/.test(d2.suggestedFilename()), "botón STL descarga " + d2.suggestedFilename());
ok(await page.evaluate(() => typeof geoXml === "undefined"), "se retiró el exportador genérico (geoXml)");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
