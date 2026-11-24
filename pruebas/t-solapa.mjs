// Apoyo de mesa «Solapa trasera»: la placa queda inclinada 10° hacia atrás y de su cara de atrás, por el borde de
// abajo, sale una solapa plana que descansa en la mesa (como un hablador acrílico en L). Una pieza, sin soportes,
// se imprime boca abajo con el frente liso y el color incrustado 1 mm.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, huella, mismaHuella, disenoForma, FORMAS, ok, fin, RAIZ } from "./lib.mjs";
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/siluetas.json"), "utf8"));
const { page, cerrar, errores } = await abrirApp();
const ops = await page.evaluate(() => Array.from(document.querySelectorAll("#apoyo option")).map((o) => o.value + "=" + o.textContent));
const hay = await page.evaluate(() => typeof baseSolapa === "function" && typeof solapaTrasera === "function" && typeof estabilidadMesa === "function");
if (!ok(hay && ops.includes("solapa=Solapa trasera (mesa)"), "existe la opción «Solapa trasera (mesa)» y sus funciones: " + ops.join(", "))){ await cerrar(); fin(); }
ok(!ops.some((o) => /^pie=|^pata=/.test(o)) && ops.length === 3, "el apoyo de mesa es uno solo (se retiró el pie delantero)");

const filas = [];
for (const forma of FORMAS){
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "ninguno", relieve: "1.0" } })); const sin = await huella(page);
  const islasSin = await page.evaluate(() => comprobarUniones().n);
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "solapa", relieve: "1.0" } }));
  const r = await page.evaluate(async () => {
    const sol = GEOS.piezas.filter((p) => p.rol === "apoyo")[0], d = GEOS.apoyo;
    if (!sol || !d) return null;
    const g = 3, G = Math.PI / 180;
    // malla de la solapa: cerrada
    const a0 = geoDePieza(sol).attributes.position, mp = new Map(), id = (a, i) => a.getX(i).toFixed(3) + "," + a.getY(i).toFixed(3) + "," + a.getZ(i).toFixed(3);
    for (let i = 0; i < a0.count; i += 3){ const v = [id(a0, i), id(a0, i + 1), id(a0, i + 2)]; if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
      for (let k = 0; k < 3; k++){ const e = v[k] + ">" + v[(k + 1) % 3], inv = v[(k + 1) % 3] + ">" + v[k]; if (mp.get(inv)) mp.set(inv, mp.get(inv) - 1); else mp.set(e, (mp.get(e) || 0) + 1); } }
    let sueltas = 0; mp.forEach((n) => { if (n !== 0) sueltas++; });
    // frente liso: ninguna pieza de color sobresale de la placa y el color ocupa el milímetro del frente
    let zTope = -1e9, zColorMin = 1e9; GEOS.piezas.forEach((pz) => pz.prismas.forEach((pr) => { zTope = Math.max(zTope, pr.z1); if (pz.rol !== "placa") zColorMin = Math.min(zColorMin, pr.z0); }));
    // tal como se exporta (boca abajo): apoyo en la cama, color en el primer milímetro, sin caras colgando
    const partes = partesParaExportar();
    const prismas = []; GEOS.piezas.forEach((pz) => pz.prismas.forEach((pr) => prismas.push({ z0: g - pr.z1, z1: g - pr.z0, paths: pzPaths(pr.shapes) })));
    const dentro = (paths, x, y) => { let n = 0; for (const r of paths){ if (ClipperLib.Clipper.PointInPolygon({ X: Math.round(x * 100), Y: Math.round(y * 100) }, r) !== 0) n++; } return n % 2 === 1; };
    // al exportar x cambia de signo. Los bordes de las piezas se limpian a 0,02 mm: entre dos piezas vecinas puede quedar
    // una rendija de centésimas; una cara cuenta como apoyada si hay material justo debajo o a 0,05 mm de su centro.
    const apoyada1 = (x, y, z) => prismas.some((q) => q.z0 < z - 1e-4 && q.z1 >= z - 1e-3 && dentro(q.paths, -x, y));
    const apoyada = (x, y, z) => [[0, 0], [0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]].some((d) => apoyada1(x + d[0], y + d[1], z));
    let zmin = 1e9, zmax = -1e9, colgando = 0, zColorMax = -1e9, volTexto = 0, peorSolapa = 1;
    partes.forEach((pt) => { const a = pt.geo.attributes.position;
      for (let i = 0; i < a.count; i += 3){
        const p = [0, 1, 2].map((k) => new THREE.Vector3(a.getX(i + k), a.getY(i + k), a.getZ(i + k)));
        zmin = Math.min(zmin, p[0].z, p[1].z, p[2].z); zmax = Math.max(zmax, p[0].z, p[1].z, p[2].z);
        if (pt.nombre !== "Placa" && pt.nombre !== "Solapa") zColorMax = Math.max(zColorMax, p[0].z, p[1].z, p[2].z);
        if (pt.nombre === "Texto") volTexto += p[0].dot(p[1].clone().cross(p[2])) / 6;
        const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])), area = n.length() / 2; if (area < 1e-6) continue; n.normalize();
        const c = p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3);
        if (pt.nombre === "Solapa" && c.z > g + 0.6) peorSolapa = Math.min(peorSolapa, n.z); // la solapa sube casi vertical: sin voladizos
        if (n.z < -Math.SQRT1_2 - 0.001 && !(Math.abs(c.z) < 1e-4 || apoyada(c.x, c.y, c.z))) colgando += area;
      } });
    const est = estabilidadMesa(GEOS.piezas, "solapa", d);
    abrirExportar(); const txt = document.getElementById("expResumen").textContent; document.getElementById("btnCerrarExp").click();
    const zip = await JSZip.loadAsync(await construir3mf());
    const ms = new DOMParser().parseFromString(await zip.file("Metadata/model_settings.config").async("string"), "application/xml");
    const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
    const xml = Array.from(ms.getElementsByTagName("part")).map((p) => meta(p, "name") + "=" + meta(p, "extruder"));
    grupo.updateMatrixWorld(true); let wz0 = 1e9, wz1 = -1e9, wy1 = -1e9; const v3 = new THREE.Vector3();
    grupo.children.forEach((m) => { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++){ v3.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); wz0 = Math.min(wz0, v3.z); wz1 = Math.max(wz1, v3.z); wy1 = Math.max(wy1, v3.y); } });
    return { islas: comprobarUniones().n, sueltas, d, zTope, zColorMin, zmin, zmax, colgando, zColorMax, volTexto, peorSolapa, est, txt, xml, nPal: GEOS.d2.nPalitos, alto: GEOS.altoMm,
      rx: grupo.rotation.x, wz0, wz1, wy1, mesa: mesa.visible, relOff: $("#relieve").disabled, nota: document.getElementById("apoyoNota").textContent, tip: document.querySelector(".canvas-tip").textContent };
  });
  if (!ok(!!r, forma + ": con Solapa trasera hay una pieza «Solapa» y datos de apoyo")) continue;
  const con = await huella(page);
  ok(r.islas === islasSin && r.sueltas === 0, forma + ": sigue en una sola pieza y la solapa es una malla cerrada");
  ok(Math.abs(r.d.inclinacion - 10) < 1e-9 && r.d.largo >= 35 && r.d.largo <= 70 && r.d.x1 - r.d.x0 >= 40, forma + ": inclinación 10°, solapa de " + r.d.largo.toFixed(0) + " × " + (r.d.x1 - r.d.x0).toFixed(0) + " mm");
  ok(Math.abs(r.zTope - 3) < 1e-6 && Math.abs(r.zColorMin - 2) < 1e-6, forma + ": frente liso (nada sobresale de los 3 mm) con el color incrustado 1 mm");
  ok(Math.abs(r.zmin) < 1e-4 && r.zColorMax <= 1 + 1e-4 && r.volTexto > 1, forma + ": se exporta boca abajo (frente en la cama, color en el primer milímetro) sin espejar el texto");
  ok(r.colgando < 3 && r.peorSolapa > -Math.sin(11 * Math.PI / 180), forma + ": se imprime sin soportes (sin apoyo: " + r.colgando.toFixed(2) + " mm²; la solapa sube a " + (Math.asin(-r.peorSolapa) * 180 / Math.PI).toFixed(1) + "° de la vertical)");
  ok(Math.abs(r.zmax - (3 + r.d.largo * Math.cos(10 * Math.PI / 180))) < 0.05, forma + ": en la cama la solapa sube " + (r.zmax - 3).toFixed(1) + " mm");
  ok(mismaHuella(con, sin, ["placa", "altoMm", "borde"]), forma + ": el diseño (texto, figura, adorno) no cambia");
  ok(r.est.adelante >= 10 && r.est.atras >= 15, forma + ": aguanta " + r.est.adelante.toFixed(1) + "° hacia adelante y " + r.est.atras.toFixed(1) + "° hacia atrás");
  ok(/Solapa trasera/.test(r.txt) && /boca abajo/.test(r.txt) && new RegExp("aguanta " + Math.round(r.est.adelante) + "° hacia adelante y " + Math.round(r.est.atras) + "° hacia atrás").test(r.txt), forma + ": el resumen dice que va boca abajo y cuánto aguanta");
  ok(r.xml[0] === "Placa=1" && r.xml[r.xml.length - 1] === "Solapa=1", forma + ": el proyecto lleva la parte «Solapa» con el filamento de la placa: " + r.xml.join(", "));
  ok(Math.abs(r.rx - (Math.PI / 2 - 10 * Math.PI / 180)) < 1e-6 && Math.abs(r.wz0) < 0.05 && r.wz1 > r.alto * 0.9 && r.wy1 > r.d.largo * 0.9 && r.mesa && /parado/i.test(r.tip), forma + ": la vista lo muestra parado, inclinado 10° hacia atrás, con la solapa sobre la mesa");
  ok(r.nPal === 0 && r.relOff && /frente.*liso/i.test(r.nota), forma + ": sin palitos, relieve desactivado y aviso: «" + r.nota + "»");
  filas.push(forma + " " + r.est.adelante.toFixed(1) + "/" + r.est.atras.toFixed(1));
}
console.log("  aguante adelante/atrás (grados): " + filas.join(" · "));

// rectángulo: la solapa sale del propio borde recto, sin franja añadida
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "ninguno" } })); const r0 = await huella(page);
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "solapa" } })); const r1 = await huella(page);
ok(JSON.stringify(r1.placa) === JSON.stringify(r0.placa) && r1.altoMm === r0.altoMm, "rectángulo: la placa no cambia; la solapa sale de su propio borde de abajo");
// figura PRO y borde: también al ras
await aplicar(page, Object.assign(disenoForma("contorno", false, { campos: { apoyo: "solapa" }, raiz: { bordeOn: true } }), { motivo: await page.evaluate(() => { const m = (window.MOTIVOS_PRO || []).filter((x) => x.capas && x.capas.length > 1)[0]; return buscarMotivo(m.nombre); }) }));
const pro = await page.evaluate(() => { let z = -1e9; GEOS.piezas.forEach((p) => p.prismas.forEach((q) => { z = Math.max(z, q.z1); })); return { z, capas: GEOS.piezas.filter((p) => p.rol === "capa").length, borde: GEOS.piezas.some((p) => p.rol === "borde"), islas: comprobarUniones().n }; });
ok(Math.abs(pro.z - 3) < 1e-6 && pro.capas >= 2 && pro.borde, "figura PRO y borde con solapa: todo al ras del frente (" + pro.capas + " colores de figura)");
// arrastrar la figura estando parado
{
  await aplicar(page, Object.assign(disenoForma("contorno", false, { campos: { apoyo: "solapa" } }), { motivo: await page.evaluate(() => buscarMotivo("Mariposa")) }));
  const pt = await page.evaluate(() => { grupo.updateMatrixWorld(true); const b = [1e9, -1e9, 1e9, -1e9, 1e9], v = new THREE.Vector3();
    grupo.children.filter((m) => m.userData.rol === "motivo").forEach((m) => { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++){ v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); b[0] = Math.min(b[0], v.x); b[1] = Math.max(b[1], v.x); b[2] = Math.min(b[2], v.z); b[3] = Math.max(b[3], v.z); b[4] = Math.min(b[4], v.y); } });
    const c = new THREE.Vector3((b[0] + b[1]) / 2, b[4], (b[2] + b[3]) / 2).project(cam), r = canvas.getBoundingClientRect(); return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height }; });
  const antes = await page.evaluate(() => ({ x: MOT_OFF.x, y: MOT_OFF.y }));
  await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.mouse.move(pt.x + 25, pt.y - 12, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(200);
  const des = await page.evaluate(() => ({ x: MOT_OFF.x, y: MOT_OFF.y }));
  ok(des.x > antes.x && des.y > antes.y, "parado, arrastrar la figura a la derecha y arriba la mueve así (" + Math.round(des.x - antes.x) + ", " + Math.round(des.y - antes.y) + ")");
}
// se guarda; lo viejo abre bien; con palitos nada cambia
ok(await page.evaluate(() => { const e = estadoDiseno(); return e.campos.apoyo === "solapa" && e.palitos === false; }), "se guarda apoyo «solapa» (y palitos:false para versiones anteriores)");
await aplicar(page, disenoForma("ovalo", false, { campos: { apoyo: "pie" } }));
ok(await page.evaluate(() => $("#apoyo").value === "solapa" && !!GEOS.apoyo && GEOS.apoyo.tipo === "solapa"), "un diseño guardado con el pie delantero abre con la solapa");
let iguales = 0;
for (const forma of FORMAS){ await aplicar(page, disenoForma(forma, true)); if (mismaHuella(await huella(page), base["forma:" + forma + ":palitos"])) iguales++; }
ok(iguales === 5 && await page.evaluate(() => !GEOS.apoyo && !GEOS.piezas.some((p) => p.rol === "apoyo") && !$("#relieve").disabled && grupo.rotation.x === 0 && !mesa.visible && document.getElementById("apoyoNota").textContent === ""), "con palitos todo sigue igual (" + iguales + "/5): acostado, con relieve y sin solapa");
ok(await page.evaluate(() => { const p = partesParaExportar(); let z = 1e9; p.forEach((q) => { const a = q.geo.attributes.position; for (let i = 0; i < a.count; i++) z = Math.min(z, a.getZ(i)); }); return Math.abs(z) < 1e-6 && GEOS.piezas.some((x) => x.prismas.some((q) => q.z1 > 3.5)); }), "con palitos se exporta boca arriba y con relieve, como antes");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
