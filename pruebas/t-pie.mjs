// Apoyo de mesa «Pie delantero»: marco (barra baja + dos postes a los lados del diseño) con dos pies en rampa de 45°.
// El topper queda inclinado 9° hacia adelante para aguantar también hacia atrás. Una pieza, sin soportes.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, huella, mismaHuella, disenoForma, FORMAS, ok, fin, RAIZ } from "./lib.mjs";
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/siluetas.json"), "utf8"));
const { page, cerrar, errores } = await abrirApp();
const hay = await page.evaluate(() => typeof marcoPie === "function" && typeof piesDelanteros === "function" && typeof estabilidadMesa === "function" && !!document.querySelector('#apoyo option[value="pie"]'));
if (!ok(hay, "existen marcoPie, piesDelanteros, estabilidadMesa y la opción «Pie delantero (mesa)»")){ await cerrar(); fin(); }
ok(await page.evaluate(() => document.querySelector('#apoyo option[value="pie"]').textContent) === "Pie delantero (mesa)", "texto de la opción");

// pies sueltos: mallas cerradas, rampa a 45°, cara de apoyo inclinada 9°, sin voladizos
const cu = await page.evaluate(() => {
  const m = { yBase: -50, pies: [[-44, -32], [32, 44]], largo: 20, inclinacion: 9 };
  const g = piesDelanteros(m, 3), a = g.attributes.position, mp = new Map(); g.computeBoundingBox();
  const id = (i) => a.getX(i).toFixed(3) + "," + a.getY(i).toFixed(3) + "," + a.getZ(i).toFixed(3);
  let vol = 0, peorNz = 1, rampas = 0, apoyos = 0;
  for (let i = 0; i < a.count; i += 3){
    const v = [id(i), id(i + 1), id(i + 2)];
    for (let k = 0; k < 3; k++){ const e = v[k] + ">" + v[(k + 1) % 3], inv = v[(k + 1) % 3] + ">" + v[k]; if (mp.get(inv)) mp.set(inv, mp.get(inv) - 1); else mp.set(e, (mp.get(e) || 0) + 1); }
    const p = [0, 1, 2].map((k) => new THREE.Vector3(a.getX(i + k), a.getY(i + k), a.getZ(i + k)));
    vol += p[0].dot(p[1].clone().cross(p[2])) / 6;
    const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
    if (!(Math.abs(n.z + 1) < 1e-6 && Math.abs(p[0].z - 3) < 1e-4)) peorNz = Math.min(peorNz, n.z); // la cara de abajo descansa sobre la placa
    if (Math.abs(n.y - Math.SQRT1_2) < 1e-6 && Math.abs(n.z - Math.SQRT1_2) < 1e-6) rampas++;
    if (Math.abs(n.y + Math.cos(9 * Math.PI / 180)) < 1e-5 && Math.abs(n.z - Math.sin(9 * Math.PI / 180)) < 1e-5) apoyos++;
  }
  let sueltas = 0; mp.forEach((n) => { if (n !== 0) sueltas++; });
  const b = g.boundingBox, d = 20 * Math.tan(9 * Math.PI / 180);
  return { sueltas, vol, volEsp: 2 * 12 * (20 + d) * 20 / 2, peorNz, rampas, apoyos, caja: [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z].map((v) => +v.toFixed(3)), d: +d.toFixed(3) };
});
ok(cu.sueltas === 0 && Math.abs(cu.vol - cu.volEsp) < 0.5, "los dos pies son mallas cerradas (" + cu.vol.toFixed(0) + " mm³)");
ok(cu.rampas === 4 && cu.apoyos === 4 && cu.peorNz >= -1e-6, "cada pie: rampa a 45°, cara de apoyo inclinada 9° y ninguna cara mirando hacia abajo salvo la que descansa en la placa");
ok(JSON.stringify(cu.caja) === JSON.stringify([-44, 44, -50, +(-50 + cu.d + 20).toFixed(3), 3, 23]), "pies sobre los postes, de 20 mm de largo: " + cu.caja);

const filas = [];
for (const forma of FORMAS){
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "ninguno", relieve: "1.0" } })); const sin = await huella(page);
  const islasSin = await page.evaluate(() => comprobarUniones().n);
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "pie", relieve: "1.0" } }));
  const r = await page.evaluate(async () => {
    const pies = GEOS.piezas.filter((p) => p.rol === "apoyo")[0], d = GEOS.apoyo;
    if (!pies || !d) return null;
    const g = geoDePieza(pies); g.computeBoundingBox(); const b = g.boundingBox;
    // en orientación de impresión (z hacia arriba): una cara que mira hacia abajo solo vale en la cama o apoyada en material
    const prismas = []; GEOS.piezas.forEach((pz) => pz.prismas.forEach((pr) => prismas.push({ z0: pr.z0, z1: pr.z1, paths: pzPaths(pr.shapes) })));
    const dentro = (paths, x, y) => { let n = 0; for (const r of paths){ if (ClipperLib.Clipper.PointInPolygon({ X: Math.round(x * 100), Y: Math.round(y * 100) }, r) !== 0) n++; } return n % 2 === 1; };
    const apoyada = (x, y, z) => prismas.some((q) => q.z0 < z - 1e-6 && q.z1 >= z - 1e-4 && dentro(q.paths, x, y));
    let zmin = 1e9, colgando = 0;
    GEOS.piezas.forEach((pz) => { const a = geoDePieza(pz).attributes.position;
      for (let i = 0; i < a.count; i += 3){
        const p = [0, 1, 2].map((k) => new THREE.Vector3(a.getX(i + k), a.getY(i + k), a.getZ(i + k)));
        zmin = Math.min(zmin, p[0].z, p[1].z, p[2].z);
        const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])), area = n.length() / 2; if (area < 1e-6) continue; n.normalize();
        if (n.z < -Math.SQRT1_2 - 0.001){ const c = p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3);
          if (!(Math.abs(c.z) < 1e-6 || (c.z > 1e-6 && apoyada(c.x, c.y, c.z)))) colgando += area; }
      } });
    const caja = (sh) => { const o = [1e9, 1e9, -1e9, -1e9]; (sh || []).forEach((s) => s.extractPoints(8).shape.forEach((q) => { o[0] = Math.min(o[0], q.x); o[1] = Math.min(o[1], q.y); o[2] = Math.max(o[2], q.x); o[3] = Math.max(o[3], q.y); })); return o; };
    const cont = caja(GEOS.d2.texto.concat(GEOS.d2.motivo, GEOS.d2.adorno));
    const est = estabilidadMesa(GEOS.piezas, "pie", d);
    abrirExportar(); const txt = document.getElementById("expResumen").textContent; document.getElementById("btnCerrarExp").click();
    const zip = await JSZip.loadAsync(await construir3mf());
    const ms = new DOMParser().parseFromString(await zip.file("Metadata/model_settings.config").async("string"), "application/xml");
    const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
    const partes = Array.from(ms.getElementsByTagName("part")).map((p) => meta(p, "name") + "=" + meta(p, "extruder"));
    // recuadro en el mundo vértice a vértice (Box3.setFromObject gira el recuadro local y exagera)
    grupo.updateMatrixWorld(true); const w = { min: { z: 1e9 }, max: { z: -1e9 } }, v3 = new THREE.Vector3();
    grupo.children.forEach((m) => { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++){ v3.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); w.min.z = Math.min(w.min.z, v3.z); w.max.z = Math.max(w.max.z, v3.z); } });
    return { islas: comprobarUniones().n, pies: [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z], d, zmin, colgando, cont, est, txt, partes, nPal: GEOS.d2.nPalitos, ancho: GEOS.anchoMm, alto: GEOS.altoMm,
      mallas: grupo.children.filter((m) => m.userData.rol === "apoyo").length, nota: (document.getElementById("apoyoNota") || {}).textContent || "", rx: grupo.rotation.x, wz0: w.min.z, wz1: w.max.z };
  });
  if (!ok(!!r, forma + ": con Pie delantero hay una pieza «Pies» y datos de apoyo")) continue;
  const con = await huella(page);
  ok(r.islas === islasSin, forma + ": sigue en una sola pieza (" + r.islas + ")");
  ok(Math.abs(r.zmin) < 1e-6 && r.colgando < 3, forma + ": se imprime sin soportes (área que mira hacia abajo sin apoyo: " + r.colgando.toFixed(2) + " mm²)");
  ok(Math.abs(r.pies[2] - r.d.yBase) < 1e-3 && Math.abs(r.pies[4] - 3) < 1e-4 && Math.abs(r.pies[5] - 3 - r.d.largo) < 1e-3 && r.d.largo >= 16 && r.d.largo <= 34, forma + ": pies de " + r.d.largo.toFixed(1) + " mm sobre la cara del frente, desde el borde de abajo");
  ok(r.pies[0] < r.cont[0] - 1 && r.pies[1] > r.cont[2] + 1 && r.d.pies[0][1] <= r.cont[0] - 1 && r.d.pies[1][0] >= r.cont[2] + 1, forma + ": los pies van a los lados del diseño, no lo tapan");
  ok(Math.abs(con.placa.bbox[1] - r.d.yBase) < 0.02 && con.placa.bbox[1] < sin.placa.bbox[1] - 4 && mismaHuella(con, sin, ["placa", "altoMm", "anchoMm", "borde"]), forma + ": la placa gana el marco y el diseño no cambia");
  ok(r.ancho > sin.anchoMm + 20 && r.ancho <= 260, forma + ": la medida mostrada incluye los postes (" + sin.anchoMm + " → " + r.ancho + " mm)");
  ok(r.est.adelante >= 8 && r.est.atras >= 7, forma + ": aguanta " + r.est.atras.toFixed(1) + "° hacia atrás y " + r.est.adelante.toFixed(1) + "° hacia adelante");
  ok(new RegExp("aguanta " + Math.round(r.est.atras) + "° hacia atrás y " + Math.round(r.est.adelante) + "° hacia adelante").test(r.txt) && /Pie delantero/.test(r.txt), forma + ": el resumen de exportar dice cuánto aguanta");
  ok(r.partes[0] === "Placa=1" && r.partes.includes("Pies=1"), forma + ": el proyecto lleva la parte «Pies» con el filamento de la placa: " + r.partes.join(", "));
  ok(r.nPal === 0 && r.mallas === 1 && /inclinado/i.test(r.nota), forma + ": sin palitos, pies en la vista y aviso junto a la opción: «" + r.nota + "»");
  ok(Math.abs(r.rx - (Math.PI / 2 + 9 * Math.PI / 180)) < 1e-6 && Math.abs(r.wz0) < 0.05 && r.wz1 > r.alto * 0.9, forma + ": la vista lo muestra parado e inclinado 9°, apoyado en la mesa (z " + r.wz0.toFixed(2) + " a " + r.wz1.toFixed(0) + ")");
  filas.push(forma + " " + r.est.atras.toFixed(1) + "/" + r.est.adelante.toFixed(1));
}
console.log("  aguante atrás/adelante (grados): " + filas.join(" · "));

// --- vista parada: mesa, cámara, arrastre y vuelta a acostado
const postura = () => page.evaluate(() => { grupo.updateMatrixWorld(true); const b = { min: { z: 1e9 }, max: { z: -1e9 } }, v3 = new THREE.Vector3();
  grupo.children.forEach((m) => { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++){ v3.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); b.min.z = Math.min(b.min.z, v3.z); b.max.z = Math.max(b.max.z, v3.z); } });
  return { rx: grupo.rotation.x, z0: b.min.z, z1: b.max.z, mesa: mesa.visible, alto: GEOS.altoMm, objetivoZ: controls.target.z, camY: cam.position.y, camZ: cam.position.z, tip: document.querySelector(".canvas-tip").textContent }; });
await aplicar(page, Object.assign(disenoForma("contorno", false, { campos: { apoyo: "pie" } }), { motivo: await page.evaluate(() => buscarMotivo("Mariposa")) }));
let ps = await postura();
ok(ps.mesa && ps.objetivoZ > 10 && ps.camY < 0 && /parado/i.test(ps.tip), "se ve la mesa, la cámara mira al topper parado y el texto de ayuda lo dice: «" + ps.tip + "»");
{
  const pt = await page.evaluate(() => { grupo.updateMatrixWorld(true); const box = new THREE.Box3(); grupo.children.filter((m) => m.userData.rol === "motivo").forEach((m) => box.expandByObject(m));
    const c = box.getCenter(new THREE.Vector3()); c.y = box.min.y; c.project(cam); const r = canvas.getBoundingClientRect(); return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height }; });
  const antes = await page.evaluate(() => ({ x: MOT_OFF.x, y: MOT_OFF.y, ax: AD_OFF.x }));
  await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.move(pt.x + 25, pt.y - 12, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(200);
  const des = await page.evaluate(() => ({ x: MOT_OFF.x, y: MOT_OFF.y, ax: AD_OFF.x }));
  ok(des.x > antes.x && des.y > antes.y && des.ax === antes.ax, "parado, arrastrar la figura a la derecha y arriba la mueve a la derecha y arriba (" + Math.round(des.x - antes.x) + ", " + Math.round(des.y - antes.y) + ")");
}
await page.evaluate(() => document.getElementById("btnFrontal").click());
ps = await postura();
ok(Math.abs(ps.camZ - ps.alto / 2) < 1 && ps.camY < -100, "«Vista frontal» estando parado lo mira de frente a media altura");
await aplicar(page, disenoForma("contorno", true));
ps = await postura();
ok(ps.rx === 0 && !ps.mesa && Math.abs(ps.z0) < 0.01 && ps.z1 < 6 && ps.objetivoZ === 0 && !/parado/i.test(ps.tip), "con palitos la vista vuelve a acostado, sin mesa");

// con borde: el borde sigue el diseño, no el marco
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "pie" }, raiz: { bordeOn: true } })); const hb = await huella(page);
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "ninguno" }, raiz: { bordeOn: true } })); const hb0 = await huella(page);
ok(JSON.stringify(hb.borde) === JSON.stringify(hb0.borde), "con borde: el borde de color sigue el diseño, no el marco de los pies");
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "pie" } }));
const est = await page.evaluate(() => estadoDiseno());
ok(est.campos.apoyo === "pie" && est.palitos === false, "se guarda apoyo «pie» (y palitos:false para versiones anteriores)");
let iguales = 0;
for (const forma of FORMAS){ await aplicar(page, disenoForma(forma, true)); if (mismaHuella(await huella(page), base["forma:" + forma + ":palitos"])) iguales++; }
ok(iguales === 5 && await page.evaluate(() => !GEOS.apoyo && !GEOS.piezas.some((p) => p.rol === "apoyo") && (document.getElementById("apoyoNota").textContent === "")), "con palitos todo sigue igual que antes (" + iguales + "/5) y sin pies");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
