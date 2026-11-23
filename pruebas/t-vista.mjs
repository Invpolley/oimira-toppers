// La vista 3D y las descargas salen de las piezas de impresión; relieve por defecto 1,0; profundidad del color.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, aplicarModeloId, huella, mismaHuella, disenoForma, ok, fin, RAIZ } from "./lib.mjs";
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/siluetas.json"), "utf8"));
const viejo = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/boceto-viejo.json"), "utf8"));
const { page, cerrar, errores } = await abrirApp();
if (!ok(await page.evaluate(() => typeof piezasDeImpresion === "function" && !!(GEOS && GEOS.piezas)), "la app carga piezas.js y refrescar() deja GEOS.piezas")){ await cerrar(); fin(); }

// --- los 12 modelos: misma silueta, relieve 1,0, una malla por pieza
const ids = await page.evaluate(() => MODELOS.map((m) => m.id));
let sil = 0, rel = 0, mallas = 0;
for (const id of ids){
  await aplicarModeloId(page, id);
  if (mismaHuella(await huella(page), base["modelo:" + id])) sil++;
  const e = await page.evaluate(() => ({ rel: $("#relieve").value, n: grupo.children.length, p: GEOS.piezas.length, roles: grupo.children.every((m, i) => m.userData.rol === GEOS.piezas[i].rol) }));
  if (e.rel === "1.0") rel++;
  if (e.n === e.p && e.p >= 2 && e.roles) mallas++;
}
ok(sil === 12, "los 12 modelos conservan su silueta de frente (" + sil + "/12)");
ok(rel === 12, "los 12 modelos parten con relieve 1,0 (" + rel + "/12)");
ok(mallas === 12, "la vista tiene una malla por pieza de impresión, con su rol (" + mallas + "/12)");
ok(await page.evaluate(() => document.getElementById("relieve").defaultValue === "1.0"), "el relieve por defecto de la pantalla es 1,0");

// --- boceto viejo: conserva su relieve 1,2 y su silueta
await aplicar(page, viejo.diseno);
ok(await page.evaluate(() => $("#relieve").value) === "1.2" && mismaHuella(await huella(page), viejo.huella), "un boceto guardado conserva su relieve 1,2 y su silueta");
ok(await page.evaluate(() => $("#profColor").value) === "1.0", "un boceto guardado sin profundidad de color usa 1,0");

// --- arrastrar la figura: mueve la figura (no el adorno), también si es PRO
async function arrastrarFigura(){
  await page.evaluate(() => { document.getElementById("btnFrontal").click(); });
  await page.waitForTimeout(250);
  const pt = await page.evaluate(() => {
    const box = new THREE.Box3(); grupo.children.filter((m) => m.userData.rol === "motivo" || m.userData.rol === "capa").forEach((m) => box.expandByObject(m));
    const c = box.getCenter(new THREE.Vector3()); c.z = box.max.z; c.project(cam);
    const r = canvas.getBoundingClientRect(); return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height };
  });
  const antes = await page.evaluate(() => ({ m: Object.assign({}, MOT_OFF), a: Object.assign({}, AD_OFF) }));
  await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.move(pt.x + 30, pt.y - 10, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(200);
  const despues = await page.evaluate(() => ({ m: Object.assign({}, MOT_OFF), a: Object.assign({}, AD_OFF) }));
  return { movioFigura: despues.m.x !== antes.m.x || despues.m.y !== antes.m.y, movioAdorno: despues.a.x !== antes.a.x || despues.a.y !== antes.a.y };
}
await aplicarModeloId(page, "mariposas-boutique");
let d = await arrastrarFigura();
ok(d.movioFigura && !d.movioAdorno, "arrastrar la figura la mueve a ella y no al adorno " + JSON.stringify(d));
await aplicarModeloId(page, "osito-corazon"); // figura PRO en capas
ok(await page.evaluate(() => GEOS.piezas.some((p) => p.rol === "capa")), "el modelo Osito usa una figura PRO en capas");
d = await arrastrarFigura();
ok(d.movioFigura && !d.movioAdorno, "arrastrar una figura PRO mueve la figura, no el adorno " + JSON.stringify(d));

// --- aro: el color del texto ya no atraviesa todo el espesor; el proyecto sale de las piezas
await aplicar(page, disenoForma("aro", true, { campos: { relieve: "1.0" } }));
const aro = await page.evaluate(async () => {
  const t = GEOS.piezas.filter((p) => p.rol === "texto")[0], g = geoDePieza(t); g.computeBoundingBox();
  const partes = partesParaExportar();
  const zip = await JSZip.loadAsync(await construir3mf());
  const ms = new DOMParser().parseFromString(await zip.file("Metadata/model_settings.config").async("string"), "application/xml");
  const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
  return { alto: +(g.boundingBox.max.z - g.boundingBox.min.z).toFixed(3), z0: +g.boundingBox.min.z.toFixed(3), nombres: partes.map((p) => p.nombre), piezas: GEOS.piezas.map((p) => p.nombre),
    xml: Array.from(ms.getElementsByTagName("part")).map((p) => meta(p, "name") + "=" + meta(p, "extruder")) };
});
ok(aro.alto === 1 && aro.z0 === 3, "aro: la pieza Texto mide 1 mm de alto (de 3 a 4), no todo el espesor: alto " + aro.alto + " desde " + aro.z0);
ok(JSON.stringify(aro.nombres) === JSON.stringify(aro.piezas) && aro.xml[0] === "Placa=1" && aro.xml.includes("Texto=2"), "el proyecto 3MF lleva las piezas de impresión: " + aro.xml.join(", "));

// --- STL: un archivo por pieza
await page.evaluate(() => abrirExportar());
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnStl")]);
const tmp = path.join(RAIZ, ".superpowers", "stl-prueba.zip"); await dl.saveAs(tmp);
const nombresStl = await page.evaluate(async (b64) => Object.keys((await JSZip.loadAsync(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).files).sort(), fs.readFileSync(tmp).toString("base64"));
fs.unlinkSync(tmp);
ok(JSON.stringify(nombresStl) === JSON.stringify(["1-placa.stl", "2-texto.stl"]), "ZIP de STL: un archivo por pieza: " + nombresStl.join(", "));

// --- profundidad del color: mínimo 1
await aplicar(page, disenoForma("contorno", true, { campos: { relieve: "1.2", profColor: "0.5" } }));
const p05 = await page.evaluate(() => ({ t: GEOS.piezas.filter((p) => p.rol === "texto")[0].prismas.map((q) => [q.z0, q.z1]), campo: $("#profColor").value }));
ok(JSON.stringify(p05.t) === JSON.stringify([[3.2, 4.2]]), "profundidad 0,5 se trata como 1 mm: el texto lleva color de 3,2 a 4,2: " + JSON.stringify(p05.t));
await page.evaluate(() => { const el = $("#profColor"); el.value = "0.5"; el.dispatchEvent(new Event("change", { bubbles: true })); });
await page.waitForTimeout(700);
ok(await page.evaluate(() => $("#profColor").value) === "1.0", "al escribir 0,5 el campo vuelve a 1,0");
await aplicar(page, disenoForma("contorno", true, { campos: { relieve: "1.2", profColor: "2.0" } }));
ok(JSON.stringify(await page.evaluate(() => { const q = GEOS.piezas.filter((p) => p.rol === "texto")[0].prismas; return [Math.min(...q.map((x) => x.z0)), Math.max(...q.map((x) => x.z1))]; })) === JSON.stringify([2.2, 4.2]) && (await page.evaluate(() => estadoDiseno().campos.profColor)) === "2.0", "profundidad 2,0: color de 2,2 a 4,2 y se guarda en el diseño");

// --- rapidez: 3 líneas + figura PRO
const pro = await page.evaluate(() => { const m = (window.MOTIVOS_PRO || []).filter((x) => x.capas && x.capas.length > 1)[0]; return m ? buscarMotivo(m.nombre) : null; });
await aplicar(page, disenoForma("contorno", true, { campos: { l1: "Feliz", l2: "Cumpleaños", l3: "Valentina" }, raiz: { motivo: pro, bordeOn: true } }));
const ms = await page.evaluate(() => { const v = []; for (let i = 0; i < 5; i++){ const t = performance.now(); refrescar(); v.push(performance.now() - t); } return v.sort((a, b) => a - b)[2]; });
// (medido el 23-11-2026 en la máquina de pruebas: ~430 ms; la versión anterior, sin regla de color, ~200 ms.
//  El refresco va con espera de 350 ms tras la última tecla; 600 ms deja margen al ruido de la máquina.)
ok(ms < 600, "refrescar con 3 líneas + figura PRO + borde tarda " + Math.round(ms) + " ms (límite 600)");
await aplicar(page, disenoForma("contorno", true));
const ms2 = await page.evaluate(() => { const v = []; for (let i = 0; i < 5; i++){ const t = performance.now(); refrescar(); v.push(performance.now() - t); } return v.sort((a, b) => a - b)[2]; });
ok(ms2 < 300, "refrescar con un diseño normal (2 líneas) tarda " + Math.round(ms2) + " ms (límite 300)");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
