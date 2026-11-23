// Regla de profundidad de color: sólidos -> piezas de impresión. Comprobación por columnas en puntos al azar.
import { abrirApp, aplicar, disenoForma, FORMAS, ok, fin } from "./lib.mjs";
const { page, cerrar, errores } = await abrirApp();
if (!(await page.evaluate(() => !!document.querySelector('script[src^="piezas.js"]')))) await page.addScriptTag({ url: "piezas.js" }).catch(() => {});
const hay = await page.evaluate(() => typeof piezasDeImpresion === "function" && typeof geoDePieza === "function" && !!(GEOS && GEOS.solidos));
if (!ok(hay, "existen piezasDeImpresion, geoDePieza y GEOS.solidos")){ await cerrar(); fin(); }

// Comprueba un diseño ya aplicado. Devuelve contadores y el primer fallo de cada tipo.
const comprobar = (prof, semilla) => page.evaluate(({ prof, semilla }) => {
  const E = 100, P = Math.max(1, prof), norm = (c) => String(c).toLowerCase();
  const sol = window.__solPrueba || GEOS.solidos, piezas = piezasDeImpresion(sol, prof), colorPlaca = norm(sol[0].color);
  function aPaths(shapes){ // misma rejilla de 0,01 mm que usa el motor; par-impar por shape, unión entre shapes
    const c = new ClipperLib.Clipper();
    shapes.forEach((s) => { const p = s.extractPoints(48); if (p.shape.length < 3) return;
      const cc = new ClipperLib.Clipper(), u = new ClipperLib.Paths();
      cc.AddPaths([p.shape].concat((p.holes || []).filter((h) => h.length > 2)).map((r) => r.map((q) => ({ X: Math.round(q.x * E), Y: Math.round(q.y * E) }))), ClipperLib.PolyType.ptSubject, true);
      cc.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd); c.AddPaths(u, ClipperLib.PolyType.ptSubject, true); });
    const U = new ClipperLib.Paths(); c.Execute(ClipperLib.ClipType.ctUnion, U, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero); return U;
  }
  function dentro1(paths, pt){ let n = 0; for (const r of paths){ const k = ClipperLib.Clipper.PointInPolygon(pt, r); if (k === -1) return null; if (k === 1) n++; } return n % 2 === 1; }
  // Los contornos de las piezas se limpian a 0,02 mm: un punto solo cuenta si él y sus vecinos a 0,05 mm coinciden
  // (si no, está pegado a un borde y se salta).
  function dentro(paths, pt){
    const a = dentro1(paths, pt); if (a === null) return null;
    for (const d of [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4], [4, -4], [-4, 4]]) if (dentro1(paths, { X: pt.X + d[0], Y: pt.Y + d[1] }) !== a) return null;
    return a;
  }
  const S = sol.map((s) => ({ s, paths: aPaths(s.shapes) }));
  const Q = []; piezas.forEach((pz) => pz.prismas.forEach((pr) => Q.push({ pz, pr, paths: aPaths(pr.shapes) })));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  S.forEach((o) => o.paths.forEach((r) => r.forEach((q) => { x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); y0 = Math.min(y0, q.Y); y1 = Math.max(y1, q.Y); })));
  let seed = semilla; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const une = (iv) => { iv = iv.slice().sort((a, b) => a[0] - b[0]); const o = []; iv.forEach((i) => { if (o.length && i[0] <= o[o.length - 1][1] + 1e-6) o[o.length - 1][1] = Math.max(o[o.length - 1][1], i[1]); else o.push([i[0], i[1]]); }); return o; };
  const r = { puntos: 0, conMaterial: 0, solape: 0, forma: 0, color: 0, ej: {} };
  for (let i = 0; i < 400; i++){
    const pt = { X: Math.round(x0 + (x1 - x0) * rnd()), Y: Math.round(y0 + (y1 - y0) * rnd()) };
    let borde = false; const col = [];
    for (const o of S){ const d = dentro(o.paths, pt); if (d === null){ borde = true; break; } if (d) col.push(o.s); }
    if (borde) continue;
    const mios = [];
    for (const o of Q){ const d = dentro(o.paths, pt); if (d === null){ borde = true; break; } if (d) mios.push([o.pr.z0, o.pr.z1, norm(o.pz.color), o.pz.rol]); }
    if (borde) continue;
    r.puntos++;
    if (col.length) r.conMaterial++;
    mios.sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < mios.length; k++) if (mios[k][0] < mios[k - 1][1] - 1e-6){ r.solape++; r.ej.solape = r.ej.solape || [pt, mios]; }
    const esp = une(col.map((s) => [s.z0, s.z1])), obt = une(mios.map((m) => [m[0], m[1]]));
    if (JSON.stringify(esp.map((v) => v.map((n) => +n.toFixed(4)))) !== JSON.stringify(obt.map((v) => v.map((n) => +n.toFixed(4))))){ r.forma++; r.ej.forma = r.ej.forma || [pt, esp, obt]; }
    if (!col.length) continue;
    const arriba = col.slice().sort((a, b) => (b.z1 - a.z1) || (b.prioridad - a.prioridad))[0];
    for (const m of mios){
      const medio = (m[0] + m[1]) / 2, quiero = medio >= arriba.z1 - P ? norm(arriba.color) : colorPlaca;
      if (m[2] !== quiero){ r.color++; r.ej.color = r.ej.color || [pt, m, quiero, arriba.rol, arriba.z1]; }
      if (norm(arriba.color) !== colorPlaca && m[0] < arriba.z1 - P - 1e-6 && m[1] > arriba.z1 - P + 1e-6){ r.color++; r.ej.corte = [pt, m, arriba.z1 - P]; } // un tramo no puede cruzar el límite de color
    }
  }
  // mallas: cada prisma extruido es cerrado y con volumen
  let abiertas = 0, sinVol = 0, prismas = 0, enT = 0;
  piezas.forEach((pz) => pz.prismas.forEach((pr) => {
    prismas++;
    const g = geoDePieza({ rol: pz.rol, nombre: pz.nombre, color: pz.color, prismas: [pr], extra: null }), a = g.attributes.position, m = new Map();
    const id = (i) => a.getX(i).toFixed(3) + "," + a.getY(i).toFixed(3) + "," + a.getZ(i).toFixed(3);
    let vol = 0;
    for (let i = 0; i < a.count; i += 3){
      const v = [id(i), id(i + 1), id(i + 2)];
      if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
      for (let k = 0; k < 3; k++){ const e = v[k] + ">" + v[(k + 1) % 3], inv = v[(k + 1) % 3] + ">" + v[k]; if (m.get(inv)) m.set(inv, m.get(inv) - 1); else m.set(e, (m.get(e) || 0) + 1); }
      const p = [0, 1, 2].map((k) => [a.getX(i + k), a.getY(i + k), a.getZ(i + k)]);
      vol += (p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0])) / 6;
    }
    // Aristas sin pareja exacta: se aceptan solo si son uniones en T (una arista larga frente a varias cortas en la
    // misma recta que la cubren entera, en sentido contrario). Cobertura neta distinta de cero = agujero de verdad.
    const lineas = new Map(); let uniT = 0;
    const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y){ const t = x % y; x = y; y = t; } return x; };
    m.forEach((n, e) => {
      if (n === 0) return; uniT++;
      const [A, B] = e.split(">").map((t) => t.split(",").map((v) => Math.round(+v * 1000)));
      let d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; const g = gcd(gcd(d[0], d[1]), d[2]) || 1; d = d.map((v) => v / g);
      let sg = 1; if (d[0] < 0 || (d[0] === 0 && (d[1] < 0 || (d[1] === 0 && d[2] < 0)))){ d = d.map((v) => -v); sg = -1; }
      const cr = [A[1] * d[2] - A[2] * d[1], A[2] * d[0] - A[0] * d[2], A[0] * d[1] - A[1] * d[0]];
      const k = d.join(",") + "|" + cr.join(","), t = (P) => P[0] * d[0] + P[1] * d[1] + P[2] * d[2];
      if (!lineas.has(k)) lineas.set(k, []);
      lineas.get(k).push([Math.min(t(A), t(B)), Math.max(t(A), t(B)), sg * n]);
    });
    let sueltas = 0;
    lineas.forEach((ev) => {
      const cortes = Array.from(new Set(ev.flatMap((x) => [x[0], x[1]]))).sort((x, y) => x - y);
      for (let i = 0; i + 1 < cortes.length; i++){ const mid = (cortes[i] + cortes[i + 1]) / 2; let neto = 0; ev.forEach((x) => { if (x[0] < mid && mid < x[1]) neto += x[2]; }); if (neto !== 0){ sueltas++; break; } }
    });
    enT += uniT;
    if (sueltas) abiertas++;
    if (!(vol > 1e-4)) sinVol++;
  }));
  return Object.assign(r, { prismas, abiertas, sinVol, enT, primera: piezas[0] && piezas[0].rol, roles: piezas.map((p) => p.rol + ":" + p.prismas.length),
    resumen: JSON.stringify(piezas.map((p) => [p.rol, p.color, p.prismas.map((q) => [q.z0, q.z1, q.shapes.length])])) });
}, { prof, semilla });

const proMot = await page.evaluate(() => { const m = (window.MOTIVOS_PRO || []).filter((x) => x.capas && x.capas.length > 1)[0]; return m ? buscarMotivo(m.nombre) : null; });
const planoMot = await page.evaluate(() => buscarMotivo("Mariposa"));
let caso = 0, totalT = 0, totalPr = 0;
for (const forma of FORMAS) for (const rel of ["0.6", "1.0", "1.2", "3.0"]) for (const pro of [false, true]){
  await aplicar(page, disenoForma(forma, true, { campos: { relieve: rel, c3: "#1565c0" }, raiz: { motivo: pro ? proMot : planoMot, bordeOn: true } }));
  const r = await comprobar(1.0, 1000 + (caso++));
  const n = forma + " relieve " + rel + (pro ? " PRO" : "");
  ok(r.conMaterial > 40 && r.solape === 0, n + ": las piezas no se solapan (" + r.conMaterial + " puntos con material) " + JSON.stringify(r.ej.solape || ""));
  ok(r.forma === 0, n + ": misma forma y alturas que los sólidos " + JSON.stringify(r.ej.forma || ""));
  ok(r.color === 0, n + ": el milímetro de arriba es del color visible y el resto del color de la placa " + JSON.stringify(r.ej.color || r.ej.corte || ""));
  ok(r.abiertas === 0 && r.sinVol === 0 && r.primera === "placa", n + ": " + r.prismas + " prismas cerrados, placa primero (abiertos " + r.abiertas + ", sin volumen " + r.sinVol + ")");
  totalT += r.enT; totalPr += r.prismas;
}
console.log("  (uniones en T toleradas: " + totalT + " aristas en " + totalPr + " prismas)");
// Elemento que sobresale de la placa (sin placa debajo). En la app no se puede provocar: la placa siempre crece o el
// contenido se escala para caber; se prueba la regla directamente con sólidos armados a mano.
await page.evaluate(() => {
  const rect = (x0, y0, x1, y1) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s; };
  window.__solPrueba = [
    { rol: "placa", nombre: "Placa", color: "#ffffff", shapes: [rect(0, 0, 40, 30)], z0: 0, z1: 3, prioridad: 0 },
    { rol: "motivo", nombre: "Figura", color: "#0000ff", shapes: [rect(30, 10, 60, 20)], z0: 3, z1: 4.2, prioridad: 3 },   // sobresale 20 mm
    { rol: "texto", nombre: "Texto", color: "#ff0000", shapes: [rect(5, 5, 35, 15)], z0: 3, z1: 3.6, prioridad: 4 },       // relieve bajo: el color se hunde
    { rol: "capa", nombre: "Figura capa 1", color: "#ffffff", shapes: [rect(10, 20, 20, 28)], z0: 3, z1: 3.45, prioridad: 10 }, // mismo color que la placa
  ];
});
const fuera = 200;
ok(true, "caso sintético: la figura sobresale 20 mm de la placa");
let r = await comprobar(1.0, 77);
ok(r.conMaterial > 100 && r.solape === 0 && r.forma === 0 && r.color === 0 && r.abiertas === 0, "figura fuera de la placa: regla y mallas correctas " + JSON.stringify(r.ej));
const sint = JSON.parse(r.resumen);
ok(JSON.stringify(sint.filter((p) => p[0] === "motivo")[0][2].map((q) => [q[0], q[1]])) === JSON.stringify([[3.2, 4.2]]), "sintético: la figura lleva color solo en su milímetro de arriba (3,2 a 4,2)");
ok(sint.filter((p) => p[0] === "texto")[0][2][0][0] === 2.6, "sintético: con relieve 0,6 el color del texto se hunde hasta 2,6");
await page.evaluate(() => { window.__solPrueba = null; });

// casos fijos
await aplicar(page, disenoForma("contorno", true, { campos: { relieve: "1.0" } }));
r = await comprobar(1.0, 5);
const piezas = JSON.parse(r.resumen), texto = piezas.filter((p) => p[0] === "texto")[0], placa = piezas[0];
ok(texto && texto[2].length === 1 && texto[2][0][0] === 3 && texto[2][0][1] === 4, "contorno relieve 1,0: Texto es un solo prisma [3, 4]: " + JSON.stringify(texto && texto[2]));
ok(placa[0] === "placa" && placa[2].length === 1 && placa[2][0][0] === 0 && placa[2][0][1] === 3, "contorno relieve 1,0: Placa es un solo prisma [0, 3]: " + JSON.stringify(placa[2]));
const r04 = await comprobar(0.4, 5);
ok(r04.resumen === r.resumen, "profundidad 0,4 se trata como 1,0 (no se puede bajar del mínimo)");
const r15 = await comprobar(1.5, 5);
ok(r15.resumen !== r.resumen && r15.color === 0 && r15.forma === 0, "profundidad 1,5: el color baja medio milímetro dentro de la placa");
await aplicar(page, disenoForma("aro", true, { campos: { relieve: "1.2" } }));
r = await comprobar(1.0, 9);
const tA = JSON.parse(r.resumen).filter((p) => p[0] === "texto")[0];
ok(tA && Math.abs(Math.min(...tA[2].map((q) => q[0])) - 3.2) < 1e-6 && Math.abs(Math.max(...tA[2].map((q) => q[1])) - 4.2) < 1e-6, "aro: el color del texto ocupa solo de 3,2 a 4,2 (antes atravesaba todo el espesor): " + JSON.stringify(tA && tA[2]));
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
