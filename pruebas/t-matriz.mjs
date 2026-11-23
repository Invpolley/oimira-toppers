// Revisión cruzada: los 12 modelos × las 5 formas de placa × los apoyos (pedido de Polley, 23-11-2026).
import { abrirApp, FORMAS, ok, fin } from "./lib.mjs";
const { page, cerrar, errores } = await abrirApp();
const APOYOS = await page.evaluate(() => Array.from(document.querySelectorAll("#apoyo option")).map((o) => o.value));
ok(APOYOS.includes("palitos") && APOYOS.includes("pie") && APOYOS.includes("ninguno"), "apoyos disponibles: " + APOYOS.join(", "));
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
    if (o.apoyo === "pie"){
      const e = GEOS.apoyo ? estabilidadMesa(GEOS.piezas, "pie", GEOS.apoyo) : null;
      let cx0 = 1e9, cx1 = -1e9; GEOS.d2.texto.concat(GEOS.d2.motivo, GEOS.d2.adorno).forEach((s) => s.extractPoints(8).shape.forEach((q) => { cx0 = Math.min(cx0, q.x); cx1 = Math.max(cx1, q.x); }));
      r.pie = !!GEOS.apoyo && GEOS.piezas.some((p) => p.rol === "apoyo"); r.adelante = e ? e.adelante : 0; r.atras = e ? e.atras : 0;
      r.libre = GEOS.apoyo ? Math.min(cx0 - GEOS.apoyo.pies[0][1], GEOS.apoyo.pies[1][0] - cx1) : -1; // separación entre el diseño y los pies (están a los lados)
      r.ancho = GEOS.anchoMm; r.alto = GEOS.altoMm;
      const zip = await JSZip.loadAsync(await construir3mf()); r.partes = (await zip.file("Metadata/model_settings.config").async("string")).split("<part ").length - 1;
      abrirExportar(); r.resumen = /Pie delantero/.test(document.getElementById("expResumen").textContent); document.getElementById("btnCerrarExp").click();
    }
    return r;
  } catch (e){ return { error: String(e && e.message || e) }; }
}, { id, forma, apoyo, palN });

const malas = [], sueltas = [], atras = [], adel = [];
let combos = 0;
for (const id of ids) for (const forma of FORMAS){
  const base = await poner(id, forma, "ninguno");
  combos++;
  if (base.error){ malas.push(id + "/" + forma + "/ninguno: " + base.error); continue; }
  if (base.islas > 1) sueltas.push(id + "/" + forma + " (" + base.islas + ")");
  if (base.parado || base.mesa || base.nPal !== 0 || base.vacias) malas.push(id + "/" + forma + "/ninguno: vista o piezas inesperadas " + JSON.stringify(base));
  for (const [apoyo, palN] of [["palitos", "auto"], ["palitos", "4"], ["pie", "auto"]]){
    const r = await poner(id, forma, apoyo, palN); combos++;
    const n = id + "/" + forma + "/" + apoyo + (apoyo === "palitos" ? " " + palN : "");
    if (r.error){ malas.push(n + ": " + r.error); continue; }
    if (r.sel !== apoyo) malas.push(n + ": el selector quedó en " + r.sel);
    if (r.islas !== base.islas) malas.push(n + ": el apoyo deja piezas sueltas (" + r.islas + " contra " + base.islas + ")");
    if (r.vacias) malas.push(n + ": piezas vacías");
    if (apoyo === "palitos"){
      if (r.nPal < 1 || r.parado || r.mesa) malas.push(n + ": palitos " + r.nPal + ", parado " + r.parado);
      if (palN === "4" && r.nPal !== 4 && !/Solo cabe/.test(r.msg)) malas.push(n + ": pidió 4, puso " + r.nPal + " sin avisar");
    } else {
      if (!r.pie || !r.parado || !r.mesa || r.nPal !== 0 || !r.resumen) malas.push(n + ": falta el pie, la vista parada o el resumen " + JSON.stringify({ pie: r.pie, parado: r.parado, mesa: r.mesa, nPal: r.nPal, resumen: r.resumen }));
      if (!(r.adelante >= 8)) malas.push(n + ": hacia adelante aguanta solo " + r.adelante.toFixed(1) + "°");
      if (!(r.atras >= 7)) malas.push(n + ": hacia atrás aguanta solo " + r.atras.toFixed(1) + "°");
      if (!(r.libre >= 1)) malas.push(n + ": los pies quedan a " + r.libre.toFixed(1) + " mm del diseño");
      if (r.ancho > 320 || r.alto > 300) malas.push(n + ": no cabe en la cama (" + r.ancho + " × " + r.alto + " mm)");
      adel.push(r.adelante);
      if (r.partes !== r.piezas.length) malas.push(n + ": el proyecto tiene " + r.partes + " partes y hay " + r.piezas.length + " piezas");
      atras.push(r.atras);
    }
  }
}
ok(combos === ids.length * 20, "se revisaron " + combos + " combinaciones (" + ids.length + " modelos × 5 formas × 4 apoyos) en " + Math.round((Date.now() - T0) / 1000) + " s");
ok(malas.length === 0, "todas las combinaciones salen bien" + (malas.length ? ": " + malas.length + " con problema → " + malas.slice(0, 40).join(" || ") : ""));
ok(errores.length === 0, "sin errores de página: " + errores.slice(0, 3).join(" | "));
console.log("  pie delantero (" + atras.length + " combinaciones): hacia atrás " + Math.min(...atras).toFixed(1) + "° a " + Math.max(...atras).toFixed(1) + "°, hacia adelante " + Math.min(...adel).toFixed(1) + "° a " + Math.max(...adel).toFixed(1) + "°");
console.log("  combinaciones modelo/forma que ya salen en más de una pieza SIN apoyo (no es del apoyo): " + (sueltas.length ? sueltas.join(", ") : "ninguna"));
await cerrar(); fin();
