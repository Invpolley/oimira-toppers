// Utilidades compartidas por las pruebas de Toppers (Playwright + servidor local; Supabase SIEMPRE simulado).
import path from "node:path"; import { fileURLToPath } from "node:url";
import { servir } from "./servidor.mjs";
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = "1";
const { chromium } = await import("/opt/npm-tools/node_modules/playwright/index.mjs");
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let total = 0, fallas = 0;
export function ok(cond, nombre){ total++; if (!cond){ fallas++; console.log("  ✗ " + nombre); } return !!cond; }
export function fin(){
  if (fallas){ console.log(fallas + " de " + total + " comprobaciones FALLARON"); process.exit(1); }
  console.log(total + " comprobaciones OK"); process.exit(0);
}

// Abre la app servida desde `raiz` (por defecto, el repo). Devuelve { page, cerrar, errores }.
export async function abrirApp(opc){
  const raiz = (opc && opc.raiz) || RAIZ;
  const srv = (opc && opc.url) ? { url: opc.url, cerrar: () => {} } : await servir(raiz); // opc.url = sitio publicado
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block", deviceScaleFactor: (opc && opc.escala) || 1 });
  await ctx.route((u) => u.hostname.endsWith(".supabase.co"), (route) => {
    const post = route.request().method() !== "GET";
    route.fulfill({ status: 200, contentType: "application/json", body: post ? "{}" : "[]" });
  });
  await ctx.addInitScript(() => { try { localStorage.setItem("tp_guia_vista", "1"); } catch (e) {} });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(srv.url + ((opc && opc.query) || ""));
  await page.waitForFunction(() => typeof GEOS !== "undefined" && GEOS && Object.keys(FUENTES).length === 5, null, { timeout: 60000 });
  return { page, errores, url: srv.url, cerrar: async () => { await browser.close(); srv.cerrar(); } };
}

// Aplica un diseño (objeto de estadoDiseno / disenoDeModelo) y espera fuente + refresco.
export async function aplicar(page, diseno){
  await page.evaluate(async (d) => {
    aplicarDiseno(d, true);
    try { await cargarFuente($("#fuente").value); } catch (e) {}
    refrescar();
  }, diseno);
}
export async function aplicarModeloId(page, id){
  await page.evaluate(async (id) => {
    const m = MODELOS.filter((x) => x.id === id)[0];
    aplicarDiseno(disenoDeModelo(m), true); MODELO_SEL = m;
    try { await cargarFuente($("#fuente").value); } catch (e) {}
    refrescar();
  }, id);
}

// Huella 2D de lo construido: área y recuadro de la unión de cada pieza (0,01 mm) + medidas.
export async function huella(page){
  return page.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    function una(shapes){
      const rings = [];
      (shapes || []).forEach((s) => { const p = s.extractPoints(12); if (p.shape.length > 2) rings.push(p.shape); (p.holes || []).forEach((h) => { if (h.length > 2) rings.push(h); }); });
      if (!rings.length) return null;
      // even-odd sobre anillos de una misma shape seria lo exacto; aqui cada shape se une por separado
      const c = new ClipperLib.Clipper();
      (shapes || []).forEach((s) => {
        const p = s.extractPoints(12); if (p.shape.length < 3) return;
        const cc = new ClipperLib.Clipper(), sol = new ClipperLib.Paths();
        cc.AddPaths(toClip([p.shape].concat((p.holes || []).filter((h) => h.length > 2))), ClipperLib.PolyType.ptSubject, true);
        cc.Execute(ClipperLib.ClipType.ctUnion, sol, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
        c.AddPaths(sol, ClipperLib.PolyType.ptSubject, true);
      });
      const U = new ClipperLib.Paths();
      c.Execute(ClipperLib.ClipType.ctUnion, U, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
      let area = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      U.forEach((p) => { area += ClipperLib.Clipper.Area(p); p.forEach((q) => { x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); y0 = Math.min(y0, q.Y); y1 = Math.max(y1, q.Y); }); });
      const E = CLIP_ESC;
      return { area: r2(area / E / E), bbox: [r2(x0 / E), r2(y0 / E), r2(x1 / E), r2(y1 / E)] };
    }
    const d2 = GEOS.d2, o = { anchoMm: GEOS.anchoMm, altoMm: GEOS.altoMm, forma: GEOS.forma, nPalitos: d2.nPalitos };
    ["placa", "texto", "motivo", "adorno", "borde"].forEach((k) => { o[k] = una(d2[k]); });
    o.capas = d2.capas ? d2.capas.map((c) => una(c.shapes)) : null;
    return o;
  });
}
// Dos huellas son iguales si coinciden salvo `ignorar` (lista de claves).
export function mismaHuella(a, b, ignorar){
  const q = (h) => { const c = Object.assign({}, h); (ignorar || []).forEach((k) => delete c[k]); return JSON.stringify(c); };
  return q(a) === q(b);
}
export function disenoForma(forma, palitos, extra){
  return Object.assign({ campos: Object.assign({ l1: "Feliz", l2: "Cumpleaños", l3: "", fuente: "pacifico", arco: "0", placa: forma, estiloMot: "detalles",
    motPos: "arriba", motTam: "100", motRot: "0", adPos: "abajo", adTam: "100", adRot: "0", ancho: "140", grosor: "3", relieve: "1.2", palLen: "45",
    c1: "#f5f5f5", c2: "#d32f2f", c3: "#1565c0", c4: "#f48fb1", c5: "#1c1c1c" }, (extra && extra.campos) || {}),
    palitos: palitos, bordeOn: false, motivo: null, adorno: null, motOff: { x: 0, y: 0 }, adOff: { x: 0, y: 0 }, modelo: null }, (extra && extra.raiz) || {});
}
export const FORMAS = ["contorno", "letras", "aro", "ovalo", "rect"];
