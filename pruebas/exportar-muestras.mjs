// Guarda proyectos 3MF de muestra (los que se laminan con el Bambu Studio real). Uso: node pruebas/exportar-muestras.mjs <carpeta> [prefijo]
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, aplicarModeloId, disenoForma } from "./lib.mjs";
const DIR = process.argv[2], PRE = process.argv[3] || "";
if (!DIR){ console.log("falta la carpeta de salida"); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });
const { page, cerrar } = await abrirApp();
async function guardar(nombre){
  const b64 = await page.evaluate(async () => {
    const blob = await construir3mf(), buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
    return btoa(s);
  });
  const f = path.join(DIR, PRE + nombre + ".3mf"); fs.writeFileSync(f, Buffer.from(b64, "base64"));
  const info = await page.evaluate(() => { const p = partesParaExportar(), f = filamentosDe(p); return p.length + " partes, " + f.colores.length + " filamentos (" + f.colores.join(" ") + "), " + GEOS.anchoMm + "×" + GEOS.altoMm + " mm"; });
  console.log(path.basename(f) + ": " + info);
}
// 1) contorno con figura, adorno y borde (parecido al topper de referencia de Polley)
await aplicarModeloId(page, "mariposas-boutique");
await page.evaluate(() => { $("#bordeOn").checked = true; refrescar(); });
await guardar("contorno");
// 2) aro
await aplicar(page, disenoForma("aro", true, { campos: { c3: "#1565c0" } }));
await guardar("aro");
// 3) figura PRO en capas
const pro = await page.evaluate(() => { const m = (window.MOTIVOS_PRO || []).filter((x) => x.capas && x.capas.length > 1)[0]; return m ? buscarMotivo(m.nombre) : null; });
await aplicar(page, disenoForma("contorno", true, { raiz: { motivo: pro } }));
await guardar("pro");
await cerrar();
