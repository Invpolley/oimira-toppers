// Revisión cruzada: los 12 modelos × las 5 formas de placa × los apoyos (pedido de Polley, 23-11-2026).
import { abrirApp, FORMAS, ok, fin } from "./lib.mjs";
const { page, cerrar, errores } = await abrirApp();
const APOYOS = await page.evaluate(() => Array.from(document.querySelectorAll("#apoyo option")).map((o) => o.value));
ok(APOYOS.includes("palitos") && APOYOS.includes("solapa") && APOYOS.includes("base") && APOYOS.includes("ninguno"), "apoyos disponibles: " + APOYOS.join(", "));
const ids = (await page.evaluate(() => MODELOS.map((m) => m.id))).filter((id) => !process.env.TP_MODELOS || process.env.TP_MODELOS.split(",").includes(id));
const T0 = Date.now();
const poner = (id, forma, apoyo, palN) => page.evaluate(async (o) => {
  const m = MODELOS.filter((x) => x.id === o.id)[0], d = disenoDeModelo(m);
  d.campos.placa = o.forma; d.campos.apoyo = o.apoyo; d.campos.palN = o.palN || "auto"; d.palitos = o.apoyo === "palitos";
  try {
    aplicarDiseno(d, true); MODELO_SEL = m;
    try { await cargarFuente($("#fuente").value); } catch (e) {}
    refrescar();
    if (!GEOS || !GEOS.piezas) return { error: "sin geometría" };
    const u = comprobarUniones(), r = { islas: u.n, piezas: GEOS.piezas.map((p) => p.rol), nPal: GEOS.d2.nPalitos, msg: document.getElementById("apoyoMsg").textContent, forma: GEOS.forma, sel: $("#apoyo").value,
      parado: grupo.rotation.x !== 0, mesa: mesa.visible, vacias: GEOS.piezas.filter((p) => !p.prismas.length && !p.extra).length };
    if (o.apoyo === "solapa"){
      const e = GEOS.apoyo ? estabilidadMesa(GEOS.piezas, "solapa", GEOS.apoyo) : null;
      let zTope = -1e9; GEOS.piezas.forEach((p) => p.prismas.forEach((q) => { zTope = Math.max(zTope, q.z1); }));
      r.solapa = !!GEOS.apoyo && GEOS.piezas.some((p) => p.rol === "apoyo"); r.adelante = e ? e.adelante : 0; r.atras = e ? e.atras : 0; r.liso = Math.abs(zTope - Number($("#grosor").value)) < 1e-6;
      r.ancho = GEOS.anchoMm; r.alto = GEOS.altoMm; r.largo = GEOS.apoyo ? GEOS.apoyo.largo : 0;
      const partes = partesParaExportar(); let zmin = 1e9; partes.forEach((q) => { const a = q.geo.attributes.position; for (let i = 0; i < a.count; i++) zmin = Math.min(zmin, a.getZ(i)); }); r.zmin = zmin;
      const zip = await JSZip.loadAsync(await construir3mf()); r.partes = (await zip.file("Metadata/model_settings.config").async("string")).split("<part ").length - 1;
      abrirExportar(); r.resumen = /Solapa trasera/.test(document.getElementById("expResumen").textContent); document.getElementById("btnCerrarExp").click();
    }
    if (o.apoyo === "base"){
      const d = GEOS.apoyo, e = d && GEOS.base ? estabilidadMesa(GEOS.piezas, "base", d) : null;
      r.base = !!e; r.adelante = e ? e.adelante : 0; r.atras = e ? e.atras : 0; r.ancho = GEOS.anchoMm; r.alto = GEOS.altoMm;
      if (e){
        const zip = await JSZip.loadAsync(await construir3mf());
        r.objetos = (await zip.file("Metadata/model_settings.config").async("string")).split("<object ").length - 1;
        const items = Array.from(new DOMParser().parseFromString(await zip.file("3D/3dmodel.model").async("string"), "application/xml").getElementsByTagName("item")).map((it) => it.getAttribute("transform").split(" "));
        const ps = JSON.parse(await zip.file("Metadata/project_settings.config").async("string"));
        const caja = (geos) => { const b = [1e9, 1e9, -1e9, -1e9]; geos.forEach((g) => { const a = g.attributes.position; for (let i = 0; i < a.count; i++){ b[0] = Math.min(b[0], a.getX(i)); b[1] = Math.min(b[1], a.getY(i)); b[2] = Math.max(b[2], a.getX(i)); b[3] = Math.max(b[3], a.getY(i)); } }); return [b[2] - b[0], b[3] - b[1]]; };
        const tT = caja(partesParaExportar().map((q) => q.geo)), tB = caja([GEOS.base.geo]), girada = items[1][0] === "0";
        const rect = (it, t) => [Number(it[9]) - t[0] / 2, Number(it[10]) - t[1] / 2, Number(it[9]) + t[0] / 2, Number(it[10]) + t[1] / 2];
        const cT = rect(items[0], tT), cB = rect(items[1], girada ? [tB[1], tB[0]] : tB), nCol = ps.filament_colour.length;
        const cW = nCol > 1 ? [Number(ps.wipe_tower_x[0]), Number(ps.wipe_tower_y[0]), Number(ps.wipe_tower_x[0]) + 60, Number(ps.wipe_tower_y[0]) + 70] : null;
        const choca = (p, q) => p && q && p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3], dentro = (c) => !c || (c[0] >= 25 && c[2] <= 325 && c[1] >= 0 && c[3] <= 310);
        r.cama = !choca(cT, cB) && !choca(cT, cW) && !choca(cB, cW) && dentro(cT) && dentro(cB) && dentro(cW); r.camaDet = JSON.stringify({ cT: cT.map(Math.round), cB: cB.map(Math.round), cW, girada });
        abrirExportar(); r.resumen = /Base encajable/.test(document.getElementById("expResumen").textContent); document.getElementById("btnCerrarExp").click();
      }
    }
    return r;
  } catch (e){ return { error: String(e && e.message || e) }; }
}, { id, forma, apoyo, palN });

const malas = [], sueltas = [], atras = [], adel = [], atrasB = [], adelB = [];
let combos = 0;
for (const id of ids) for (const forma of FORMAS){
  const base = await poner(id, forma, "ninguno");
  combos++;
  if (base.error){ malas.push(id + "/" + forma + "/ninguno: " + base.error); continue; }
  if (base.islas > 1) sueltas.push(id + "/" + forma + " (" + base.islas + ")");
  if (base.parado || base.mesa || base.nPal !== 0 || base.vacias) malas.push(id + "/" + forma + "/ninguno: vista o piezas inesperadas " + JSON.stringify(base));
  for (const [apoyo, palN] of [["palitos", "auto"], ["palitos", "4"], ["solapa", "auto"], ["base", "auto"]]){
    const r = await poner(id, forma, apoyo, palN); combos++;
    const n = id + "/" + forma + "/" + apoyo + (apoyo === "palitos" ? " " + palN : "");
    if (r.error){ malas.push(n + ": " + r.error); continue; }
    if (r.sel !== apoyo) malas.push(n + ": el selector quedó en " + r.sel);
    if (r.islas > base.islas) malas.push(n + ": el apoyo deja piezas sueltas (" + r.islas + " contra " + base.islas + ")"); // menos islas = el apoyo unió algo: no es problema
    if (r.vacias) malas.push(n + ": piezas vacías");
    if (apoyo === "palitos"){
      if (r.nPal < 1 || r.parado || r.mesa) malas.push(n + ": palitos " + r.nPal + ", parado " + r.parado);
      if (palN === "4" && r.nPal !== 4 && !/Solo cabe/.test(r.msg)) malas.push(n + ": pidió 4, puso " + r.nPal + " sin avisar");
    } else if (apoyo === "base"){
      if (!r.base || !r.parado || !r.mesa || r.nPal !== 0 || !r.resumen || r.objetos !== 2) malas.push(n + ": falta la base, la vista parada, el resumen o el segundo objeto " + JSON.stringify({ base: r.base, parado: r.parado, mesa: r.mesa, nPal: r.nPal, resumen: r.resumen, objetos: r.objetos }));
      else {
        if (!r.cama) malas.push(n + ": en la cama se enciman o se salen " + r.camaDet);
        if (!(r.adelante >= 15)) malas.push(n + ": hacia adelante aguanta solo " + r.adelante.toFixed(1) + "°");
        if (!(r.atras >= 20)) malas.push(n + ": hacia atrás aguanta solo " + r.atras.toFixed(1) + "°");
        adelB.push(r.adelante); atrasB.push(r.atras);
      }
    } else {
      if (!r.solapa || !r.parado || !r.mesa || r.nPal !== 0 || !r.resumen) malas.push(n + ": falta la solapa, la vista parada o el resumen " + JSON.stringify({ solapa: r.solapa, parado: r.parado, mesa: r.mesa, nPal: r.nPal, resumen: r.resumen }));
      if (!r.liso) malas.push(n + ": el frente no quedó liso");
      if (Math.abs(r.zmin) > 1e-4) malas.push(n + ": al exportar no apoya en la cama (z mínima " + r.zmin + ")");
      if (!(r.adelante >= 10)) malas.push(n + ": hacia adelante aguanta solo " + r.adelante.toFixed(1) + "°");
      if (!(r.atras >= 15)) malas.push(n + ": hacia atrás aguanta solo " + r.atras.toFixed(1) + "°");
      if (r.partes !== r.piezas.length) malas.push(n + ": el proyecto tiene " + r.partes + " partes y hay " + r.piezas.length + " piezas");
      if (r.ancho > 320 || r.alto > 300 || r.largo > 70) malas.push(n + ": no cabe en la impresora (" + r.ancho + " × " + r.alto + " mm, solapa " + r.largo + ")");
      adel.push(r.adelante);
      atras.push(r.atras);
    }
  }
}
ok(combos === ids.length * 25, "se revisaron " + combos + " combinaciones (" + ids.length + " modelos × 5 formas × 5 apoyos) en " + Math.round((Date.now() - T0) / 1000) + " s");
ok(malas.length === 0, "todas las combinaciones salen bien" + (malas.length ? ": " + malas.length + " con problema → " + malas.slice(0, 40).join(" || ") : ""));
ok(errores.length === 0, "sin errores de página: " + errores.slice(0, 3).join(" | "));
console.log("  solapa trasera (" + atras.length + " combinaciones): hacia atrás " + Math.min(...atras).toFixed(1) + "° a " + Math.max(...atras).toFixed(1) + "°, hacia adelante " + Math.min(...adel).toFixed(1) + "° a " + Math.max(...adel).toFixed(1) + "°");
if (atrasB.length) console.log("  base encajable (" + atrasB.length + " combinaciones): hacia atrás " + Math.min(...atrasB).toFixed(1) + "° a " + Math.max(...atrasB).toFixed(1) + "°, hacia adelante " + Math.min(...adelB).toFixed(1) + "° a " + Math.max(...adelB).toFixed(1) + "°");
console.log("  combinaciones modelo/forma que ya salen en más de una pieza SIN apoyo (no es del apoyo): " + (sueltas.length ? sueltas.join(", ") : "ninguna"));
await cerrar(); fin();
