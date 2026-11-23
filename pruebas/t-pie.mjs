// Apoyo de mesa «Pie delantero»: zócalo + dos pies en rampa de 45°, una pieza, sin soportes, con estabilidad medida.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, huella, mismaHuella, disenoForma, FORMAS, ok, fin, RAIZ } from "./lib.mjs";
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/siluetas.json"), "utf8"));
const { page, cerrar, errores } = await abrirApp();
const hay = await page.evaluate(() => typeof zocalo === "function" && typeof piesDelanteros === "function" && typeof estabilidadMesa === "function" && !!document.querySelector('#apoyo option[value="pie"]'));
if (!ok(hay, "existen zocalo, piesDelanteros, estabilidadMesa y la opción «Pie delantero (mesa)»")){ await cerrar(); fin(); }
ok(await page.evaluate(() => document.querySelector('#apoyo option[value="pie"]').textContent) === "Pie delantero (mesa)", "texto de la opción");

// cuña suelta: cerrada, rampa de 45°, medidas exactas
const cu = await page.evaluate(() => {
  const g = piesDelanteros({ yBase: -50, xlo: -30, xhi: 30 }, 3), a = g.attributes.position, m = new Map(); g.computeBoundingBox();
  const id = (i) => a.getX(i).toFixed(3) + "," + a.getY(i).toFixed(3) + "," + a.getZ(i).toFixed(3);
  let vol = 0, peorNz = 1, rampas = 0;
  for (let i = 0; i < a.count; i += 3){
    const v = [id(i), id(i + 1), id(i + 2)];
    for (let k = 0; k < 3; k++){ const e = v[k] + ">" + v[(k + 1) % 3], inv = v[(k + 1) % 3] + ">" + v[k]; if (m.get(inv)) m.set(inv, m.get(inv) - 1); else m.set(e, (m.get(e) || 0) + 1); }
    const p = [0, 1, 2].map((k) => new THREE.Vector3(a.getX(i + k), a.getY(i + k), a.getZ(i + k)));
    vol += p[0].dot(p[1].clone().cross(p[2])) / 6;
    const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
    if (!(Math.abs(n.z + 1) < 1e-6 && Math.abs(p[0].z - 3) < 1e-6)) peorNz = Math.min(peorNz, n.z); // la cara de abajo descansa sobre la placa
    if (Math.abs(n.y - Math.SQRT1_2) < 1e-6 && Math.abs(n.z - Math.SQRT1_2) < 1e-6) rampas++;
  }
  let sueltas = 0; m.forEach((n) => { if (n !== 0) sueltas++; });
  const b = g.boundingBox;
  return { sueltas, vol: +vol.toFixed(2), peorNz, rampas, caja: [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z] };
});
ok(cu.sueltas === 0 && cu.vol === 2 * (14 * 14 / 2) * 12, "los dos pies forman mallas cerradas de 2 × 1176 mm³ (" + cu.vol + ")");
ok(cu.rampas === 4 && cu.peorNz >= -1e-6, "cada pie tiene su rampa a 45° y ninguna cara mira hacia abajo salvo la que apoya en la placa");
ok(JSON.stringify(cu.caja) === JSON.stringify([-30, 30, -50, -36, 3, 17]), "pies de 12 mm de ancho en los extremos del zócalo, 14 × 14 mm: " + cu.caja);

for (const forma of FORMAS){
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "ninguno", relieve: "1.0" } })); const sin = await huella(page);
  const islasSin = await page.evaluate(() => comprobarUniones().n);
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "pie", relieve: "1.0" } }));
  const r = await page.evaluate(async () => {
    const pies = GEOS.piezas.filter((p) => p.rol === "apoyo")[0], d = GEOS.apoyo;
    if (!pies || !d) return null;
    const g = geoDePieza(pies); g.computeBoundingBox(); const b = g.boundingBox;
    // todas las piezas, en orientación de impresión (z hacia arriba): caras que miran hacia abajo solo en la cama o apoyadas
    let zmin = 1e9, colgando = 0;
    // una cara que mira hacia abajo está apoyada si justo debajo hay material de cualquier pieza (un prisma que llega hasta ella)
    const prismas = []; GEOS.piezas.forEach((pz) => pz.prismas.forEach((pr) => prismas.push({ z0: pr.z0, z1: pr.z1, paths: pzPaths(pr.shapes) })));
    const dentro = (paths, x, y) => { let n = 0; for (const r of paths){ if (ClipperLib.Clipper.PointInPolygon({ X: Math.round(x * 100), Y: Math.round(y * 100) }, r) !== 0) n++; } return n % 2 === 1; };
    const dentroPlaca = (x, y, z) => prismas.some((q) => q.z0 < z - 1e-6 && q.z1 >= z - 1e-4 && dentro(q.paths, x, y));
    GEOS.piezas.forEach((pz) => { const a = geoDePieza(pz).attributes.position;
      for (let i = 0; i < a.count; i += 3){
        const p = [0, 1, 2].map((k) => new THREE.Vector3(a.getX(i + k), a.getY(i + k), a.getZ(i + k)));
        zmin = Math.min(zmin, p[0].z, p[1].z, p[2].z);
        const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])), area = n.length() / 2; if (area < 1e-6) continue; n.normalize();
        if (n.z < -Math.SQRT1_2 - 0.001){ const c = p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3);
          if (!(Math.abs(c.z) < 1e-6 || (c.z > 1e-6 && dentroPlaca(c.x, c.y, c.z)))) colgando += area; } // ni en la cama ni sobre material
      } });
    const caja = (sh) => { const o = [1e9, 1e9, -1e9, -1e9]; (sh || []).forEach((s) => s.extractPoints(8).shape.forEach((q) => { o[0] = Math.min(o[0], q.x); o[1] = Math.min(o[1], q.y); o[2] = Math.max(o[2], q.x); o[3] = Math.max(o[3], q.y); })); return o; };
    const cont = caja(GEOS.d2.texto.concat(GEOS.d2.motivo, GEOS.d2.adorno));
    const est = estabilidadMesa(GEOS.piezas, "pie", d);
    abrirExportar(); const txt = document.getElementById("expResumen").textContent; document.getElementById("btnCerrarExp").click();
    const zip = await JSZip.loadAsync(await construir3mf());
    const ms = new DOMParser().parseFromString(await zip.file("Metadata/model_settings.config").async("string"), "application/xml");
    const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
    const partes = Array.from(ms.getElementsByTagName("part")).map((p) => meta(p, "name") + "=" + meta(p, "extruder"));
    return { islas: comprobarUniones().n, piesY: [b.min.y, b.max.y], piesZ: [b.min.z, b.max.z], yBase: d.yBase, zmin, colgando, contY0: cont[1], est, txt, partes, nPal: GEOS.d2.nPalitos,
      mallas: grupo.children.filter((m) => m.userData.rol === "apoyo").length, nota: (document.getElementById("apoyoNota") || {}).textContent || "" };
  });
  if (!ok(!!r, forma + ": con Pie delantero hay una pieza «Pies» y datos de apoyo")) continue;
  const con = await huella(page);
  ok(r.islas === islasSin, forma + ": sigue en una sola pieza (" + r.islas + ")");
  // (los bordes de las piezas se limpian a 0,02 mm: quedan filos de centésimas sin apoyo, menos de 3 mm² en total;
  //  un pie o una figura en el aire serían decenas o cientos de mm²)
  ok(Math.abs(r.zmin) < 1e-6 && r.colgando < 3, forma + ": se imprime sin soportes (área que mira hacia abajo sin apoyo: " + r.colgando.toFixed(2) + " mm²)");
  ok(Math.abs(r.piesY[0] - r.yBase) < 1e-4 && Math.abs(r.piesY[1] - r.yBase - 14) < 1e-4 && Math.abs(r.piesZ[0] - 3) < 1e-4 && Math.abs(r.piesZ[1] - 17) < 1e-4, forma + ": pies sobre la cara del frente, en el borde de abajo");
  ok(r.contY0 >= r.piesY[1] + 1, forma + ": los pies no tapan el diseño (contenido desde " + r.contY0.toFixed(1) + ", pies hasta " + r.piesY[1].toFixed(1) + ")");
  ok(Math.abs(con.placa.bbox[1] - r.yBase) < 0.02 && con.placa.bbox[1] < sin.placa.bbox[1] - 13 && mismaHuella(con, sin, ["placa", "altoMm", "borde"]), forma + ": la placa gana una franja abajo y el diseño no cambia");
  ok(r.est.adelante >= 10 && r.est.atras > 0, forma + ": aguanta " + r.est.adelante.toFixed(1) + "° hacia adelante y " + r.est.atras.toFixed(1) + "° hacia atrás");
  ok(new RegExp("aguanta " + Math.round(r.est.atras) + "° hacia atrás").test(r.txt) && /Pie delantero/.test(r.txt), forma + ": el resumen de exportar dice cuánto aguanta hacia atrás");
  ok(r.partes[0] === "Placa=1" && r.partes.includes("Pies=1"), forma + ": el proyecto lleva la parte «Pies» con el filamento de la placa: " + r.partes.join(", "));
  ok(r.nPal === 0 && r.mallas === 1 && /hacia atrás, poco/.test(r.nota), forma + ": sin palitos, pies en la vista y aviso junto a la opción");
}
// con borde: el borde sigue el diseño, no el zócalo, y no se mete en los pies
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "pie" }, raiz: { bordeOn: true } }));
const bo = await page.evaluate(() => { const y = []; GEOS.d2.borde.forEach((s) => s.extractPoints(8).shape.forEach((q) => y.push(q.y))); return { bordeMin: Math.min(...y), piesMax: GEOS.apoyo.yBase + 14 }; });
ok(bo.bordeMin >= bo.piesMax - 1e-6, "con borde: el borde de color no invade los pies (borde desde " + bo.bordeMin.toFixed(1) + ", pies hasta " + bo.piesMax.toFixed(1) + ")");
// se guarda y vuelve; un diseño con palitos no cambia
const est = await page.evaluate(() => estadoDiseno());
ok(est.campos.apoyo === "pie" && est.palitos === false, "se guarda apoyo «pie» (y palitos:false para versiones anteriores)");
let iguales = 0;
for (const forma of FORMAS){ await aplicar(page, disenoForma(forma, true)); if (mismaHuella(await huella(page), base["forma:" + forma + ":palitos"])) iguales++; }
ok(iguales === 5 && await page.evaluate(() => !GEOS.apoyo && !GEOS.piezas.some((p) => p.rol === "apoyo") && (document.getElementById("apoyoNota").textContent === "")), "con palitos todo sigue igual que antes (" + iguales + "/5) y sin pies");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
