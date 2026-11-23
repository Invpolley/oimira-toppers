// Apoyo a elegir (palitos / sin apoyo) y de 1 a 4 palitos; compatibilidad con bocetos guardados.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, huella, mismaHuella, disenoForma, FORMAS, ok, fin, RAIZ } from "./lib.mjs";
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/siluetas.json"), "utf8"));
const viejo = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/boceto-viejo.json"), "utf8"));
const { page, cerrar, errores } = await abrirApp();
const ig = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- funciones puras
const f = await page.evaluate(() => typeof posicionesPalitos === "function" && typeof cantidadPalitos === "function" ? {
  a: posicionesPalitos(2, -50, 50), b: posicionesPalitos(4, -50, 50), c: posicionesPalitos(4, 0, 20), d: posicionesPalitos(1, -3, 3), e: posicionesPalitos(3, 10, 10),
  q: [cantidadPalitos("auto", 2), cantidadPalitos("auto", 1), cantidadPalitos("3", 2), cantidadPalitos("9", 2), cantidadPalitos("x", 2)] } : null);
if (!ok(!!f, "existen posicionesPalitos y cantidadPalitos")){ await cerrar(); fin(); }
ok(ig(f.a, [-25, 25]) && ig(f.b, [-37.5, -12.5, 12.5, 37.5]), "reparto parejo: 2 → ±25, 4 → ±12.5 y ±37.5");
ok(f.c.length === 2 && ig(f.c, [5, 15]), "4 en 20 mm no caben: quedan 2 (" + f.c + ")");
ok(ig(f.d, [0]) && ig(f.e, [10]), "siempre al menos 1, aunque el tramo sea mínimo");
ok(ig(f.q, [2, 1, 3, 4, 2]), "cantidad: auto usa la regla de hoy; 1–4 lo pedido; fuera de rango se acota: " + f.q);

// --- controles
const ctl = await page.evaluate(() => ({ apoyo: Array.from(document.querySelectorAll("#apoyo option")).map((o) => o.value), palN: Array.from(document.querySelectorAll("#palN option")).map((o) => o.value),
  oculto: !document.getElementById("palitos").offsetParent, msg: !!document.getElementById("apoyoMsg") }));
ok(ctl.apoyo.includes("palitos") && ctl.apoyo.includes("ninguno") && ig(ctl.palN, ["auto", "1", "2", "3", "4"]) && ctl.oculto && ctl.msg, "selector Apoyo, Cantidad (auto,1-4) y casilla vieja oculta");

// --- cada forma × 1..4 palitos
for (const forma of FORMAS){
  await aplicar(page, disenoForma(forma, false)); const sin = await page.evaluate(() => comprobarUniones().n);
  for (const n of [1, 2, 3, 4]){
    await aplicar(page, disenoForma(forma, true, { campos: { apoyo: "palitos", palN: String(n) } }));
    const r = await page.evaluate(() => ({ n: GEOS.d2.nPalitos, xs: GEOS.d2.palitosX, islas: comprobarUniones().n, msg: document.getElementById("apoyoMsg").textContent }));
    const sep = r.xs.slice().sort((a, b) => a - b).every((x, i, arr) => i === 0 || x - arr[i - 1] >= 8 - 1e-6);
    ok(r.n === n && r.xs.length === n, forma + ": " + n + " palito(s) pedidos = " + r.n + " puestos");
    ok(r.islas === sin && sep, forma + " con " + n + ": los palitos quedan unidos (islas " + r.islas + "/" + sin + ") y sin encimarse");
    ok(r.msg === "", forma + " con " + n + ": sin aviso");
  }
}
// «solo letras» con adorno debajo del texto: los palitos no pueden quedar sueltos (defecto anterior, hallado el 23-11-2026
// al cruzar modelos × formas: el palito nacía a la altura del adorno aunque en esa x no hubiera adorno)
for (const palN of ["auto", "3"]){
  const dm = (apoyo) => page.evaluate(async (o) => { const m = MODELOS.filter((x) => x.id === "mariposas-boutique")[0], d = disenoDeModelo(m);
    d.campos.placa = "letras"; d.campos.apoyo = o.apoyo; d.campos.palN = o.palN; d.palitos = o.apoyo === "palitos";
    aplicarDiseno(d, true); try { await cargarFuente($("#fuente").value); } catch (e) {} refrescar(); return { islas: comprobarUniones().n, n: GEOS.d2.nPalitos }; }, { apoyo, palN });
  const s0 = await dm("ninguno"), s1 = await dm("palitos");
  ok(s1.n >= 1 && s1.islas === s0.islas, "solo letras con adorno debajo, palitos " + palN + ": " + s1.n + " palito(s) unidos al diseño (islas " + s1.islas + " contra " + s0.islas + " sin palitos)");
}
// se ven de verdad en la silueta: 4 palitos agregan más área que 1
await aplicar(page, disenoForma("ovalo", true, { campos: { apoyo: "palitos", palN: "1" } })); const a1 = (await huella(page)).placa.area;
await aplicar(page, disenoForma("ovalo", true, { campos: { apoyo: "palitos", palN: "4" } })); const a4 = (await huella(page)).placa.area;
// contorno con cantidad elegida: todas las puntas terminan a la misma altura (45 mm bajo el punto más bajo de la silueta)
await aplicar(page, disenoForma("contorno", false)); const yMin = (await huella(page)).placa.bbox[1];
await aplicar(page, disenoForma("contorno", true, { campos: { apoyo: "palitos", palN: "3" } })); const y3 = (await huella(page)).placa.bbox[1];
ok(Math.abs((yMin - 45) - y3) < 0.02, "contorno con 3: las puntas llegan 45 mm por debajo de la silueta (" + (yMin - y3).toFixed(2) + ")");
ok(a4 - a1 > 3 * 150, "óvalo: 4 palitos suman el área de 3 palitos más que 1 (" + Math.round(a4 - a1) + " mm²)");

// --- no caben tantos: se ponen los que caben y se avisa
// (el ancho mínimo es 60 mm y ahí siempre caben 4 en contorno; en «solo letras» mandan las letras del último renglón)
await aplicar(page, disenoForma("letras", false, { campos: { l1: "Cumpleaños", l2: "y" } })); const islasY = await page.evaluate(() => comprobarUniones().n);
await aplicar(page, disenoForma("letras", true, { campos: { l1: "Cumpleaños", l2: "y", apoyo: "palitos", palN: "4" } }));
const v = await page.evaluate(() => ({ n: GEOS.d2.nPalitos, msg: document.getElementById("apoyoMsg").textContent, islas: comprobarUniones().n, xs: GEOS.d2.palitosX }));
ok(v.n >= 1 && v.n < 4 && v.msg === (v.n === 1 ? "Solo cabe 1 palito" : "Solo caben " + v.n + " palitos") + " en este diseño.", "último renglón angosto con 4 pedidos: " + v.n + " puestos y aviso «" + v.msg + "»");
ok(v.islas === islasY, "diseño angosto: los palitos no agregan piezas sueltas");

// --- Auto = lo de hoy (22 siluetas de la línea base)
let iguales = 0;
for (const forma of FORMAS) for (const pal of [true, false]){
  await aplicar(page, disenoForma(forma, pal)); // diseño "viejo": sin campos apoyo/palN
  if (mismaHuella(await huella(page), base["forma:" + forma + (pal ? ":palitos" : ":sin")])) iguales++;
  await aplicar(page, disenoForma(forma, pal, { campos: { apoyo: pal ? "palitos" : "ninguno", palN: "auto" } }));
  if (mismaHuella(await huella(page), base["forma:" + forma + (pal ? ":palitos" : ":sin")])) iguales++;
}
ok(iguales === 20, "Auto y Sin apoyo dan la misma silueta que la versión anterior (" + iguales + "/20)");

// --- boceto viejo abierto después de uno nuevo: no hereda nada
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "ninguno", palN: "3" } }));
await aplicar(page, viejo.diseno);
const e1 = await page.evaluate(() => ({ apoyo: $("#apoyo").value, palN: $("#palN").value, chk: $("#palitos").checked }));
ok(e1.apoyo === "palitos" && e1.palN === "auto" && e1.chk, "boceto viejo con palitos:true abre con Palitos / Auto (" + e1.apoyo + "/" + e1.palN + ")");
ok(mismaHuella(await huella(page), viejo.huella), "boceto viejo: misma silueta que cuando se guardó");
const viejoSin = JSON.parse(JSON.stringify(viejo.diseno)); viejoSin.palitos = false;
await aplicar(page, disenoForma("rect", true, { campos: { apoyo: "palitos", palN: "4" } }));
await aplicar(page, viejoSin);
ok(await page.evaluate(() => $("#apoyo").value === "ninguno" && $("#palN").value === "auto" && GEOS.d2.nPalitos === 0), "boceto viejo con palitos:false abre Sin apoyo");

// --- lo que se guarda
await aplicar(page, disenoForma("ovalo", true, { campos: { apoyo: "palitos", palN: "3" } }));
const g1 = await page.evaluate(() => estadoDiseno());
await page.evaluate(() => { $("#apoyo").value = "ninguno"; $("#apoyo").dispatchEvent(new Event("change", { bubbles: true })); });
await page.waitForTimeout(700);
const g2 = await page.evaluate(() => ({ e: estadoDiseno(), n: GEOS.d2.nPalitos, visN: !!document.getElementById("palN").offsetParent, visL: !!document.getElementById("palLen").offsetParent }));
ok(g1.campos.apoyo === "palitos" && g1.campos.palN === "3" && g1.palitos === true, "se guarda apoyo, cantidad y el campo viejo palitos:true");
ok(g2.e.campos.apoyo === "ninguno" && g2.e.palitos === false && g2.n === 0, "Sin apoyo: palitos:false y ningún palito");
ok(!g2.visN && !g2.visL, "Cantidad y Largo solo se ven con Palitos");
await page.evaluate(() => { $("#apoyo").value = "palitos"; $("#apoyo").dispatchEvent(new Event("change", { bubbles: true })); });
await page.waitForTimeout(700);
ok(await page.evaluate(() => !!document.getElementById("palN").offsetParent && GEOS.d2.nPalitos === 3), "al volver a Palitos reaparecen los controles y los 3 palitos");
await page.evaluate(() => abrirExportar());
ok(/3 palitos integrados de 45 mm/.test(await page.evaluate(() => document.getElementById("expResumen").textContent)), "el resumen de exportar dice cuántos palitos lleva");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
