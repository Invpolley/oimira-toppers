// Apoyo de mesa en dos piezas: el topper (impreso normal, con relieve) lleva una lengüeta abajo que encaja en una
// base aparte con ranura inclinada 10°. El proyecto 3MF trae los dos objetos.
import fs from "node:fs"; import path from "node:path";
import { abrirApp, aplicar, huella, mismaHuella, disenoForma, FORMAS, ok, fin, RAIZ } from "./lib.mjs";
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, "pruebas/base/siluetas.json"), "utf8"));
const { page, cerrar, errores } = await abrirApp();
const ops = await page.evaluate(() => Array.from(document.querySelectorAll("#apoyo option")).map((o) => o.value + "=" + o.textContent));
const hay = await page.evaluate(() => typeof baseEncajable === "function" && !!document.getElementById("holgura"));
if (!ok(hay && ops.includes("base=Base encajable (mesa, 2 piezas)"), "existe la opción «Base encajable (mesa, 2 piezas)», su función y el campo de holgura: " + ops.join(", "))){ await cerrar(); fin(); }
ok(ops.length === 4 && ops.some((o) => /^solapa=/.test(o)), "se conserva la solapa de una pieza como otra opción");

const filas = [];
for (const forma of FORMAS){
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "ninguno", relieve: "1.0" } })); const sin = await huella(page);
  const islasSin = await page.evaluate(() => comprobarUniones().n);
  await aplicar(page, disenoForma(forma, false, { campos: { apoyo: "base", relieve: "1.0" } }));
  const r = await page.evaluate(async () => {
    const d = GEOS.apoyo; if (!d || d.tipo !== "base" || !GEOS.base) return null;
    const G = Math.PI / 180, g = d.grosor, a = GEOS.base.geo.attributes.position, mp = new Map(), id = (i) => a.getX(i).toFixed(3) + "," + a.getY(i).toFixed(3) + "," + a.getZ(i).toFixed(3);
    let vol = 0, colgando = 0, b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = 0; i < a.count; i += 3){
      const v = [id(i), id(i + 1), id(i + 2)];
      for (let k = 0; k < 3; k++){ const e = v[k] + ">" + v[(k + 1) % 3], inv = v[(k + 1) % 3] + ">" + v[k]; if (mp.get(inv)) mp.set(inv, mp.get(inv) - 1); else mp.set(e, (mp.get(e) || 0) + 1); }
      const p = [0, 1, 2].map((k) => new THREE.Vector3(a.getX(i + k), a.getY(i + k), a.getZ(i + k)));
      p.forEach((q) => { b[0] = Math.min(b[0], q.x); b[1] = Math.min(b[1], q.y); b[2] = Math.min(b[2], q.z); b[3] = Math.max(b[3], q.x); b[4] = Math.max(b[4], q.y); b[5] = Math.max(b[5], q.z); });
      vol += p[0].dot(p[1].clone().cross(p[2])) / 6;
      const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])), area = n.length() / 2; if (area < 1e-6) continue; n.normalize();
      const c = p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3);
      if (n.z < -Math.SQRT1_2 - 0.001 && Math.abs(c.z) > 1e-4) colgando += area; // la base se imprime como se usa: nada puede mirar hacia abajo salvo su asiento
    }
    let sueltas = 0; mp.forEach((n) => { if (n !== 0) sueltas++; });
    // el topper: relieve intacto y lengüeta
    let zTope = -1e9; GEOS.piezas.forEach((pz) => pz.prismas.forEach((pr) => { zTope = Math.max(zTope, pr.z1); }));
    // armado en la vista: la esquina de atrás-abajo de la lengüeta cae en el fondo de la ranura
    grupo.updateMatrixWorld(true); const esquina = new THREE.Vector3(0, d.yFondo, 0).applyMatrix4(grupo.matrixWorld);
    const mallaBase = scene.children.filter((m) => m.userData && m.userData.rol === "base")[0];
    let wz0 = 1e9; const v3 = new THREE.Vector3();
    grupo.children.forEach((m) => { const q = m.geometry.attributes.position; for (let i = 0; i < q.count; i++){ v3.fromBufferAttribute(q, i).applyMatrix4(m.matrixWorld); wz0 = Math.min(wz0, v3.z); } });
    let bz0 = 1e9, bz1 = -1e9; if (mallaBase){ mallaBase.updateMatrixWorld(true); const q = mallaBase.geometry.attributes.position; for (let i = 0; i < q.count; i++){ v3.fromBufferAttribute(q, i).applyMatrix4(mallaBase.matrixWorld); bz0 = Math.min(bz0, v3.z); bz1 = Math.max(bz1, v3.z); } }
    const est = estabilidadMesa(GEOS.piezas, "base", d);
    abrirExportar(); const txt = document.getElementById("expResumen").textContent; document.getElementById("btnCerrarExp").click();
    const zip = await JSZip.loadAsync(await construir3mf());
    const ms = new DOMParser().parseFromString(await zip.file("Metadata/model_settings.config").async("string"), "application/xml");
    const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
    const objs = Array.from(ms.getElementsByTagName("object")).map((o) => ({ nombre: meta(o, "name"), ext: meta(o, "extruder"), partes: Array.from(o.getElementsByTagName("part")).map((p) => meta(p, "name") + "=" + meta(p, "extruder")) }));
    const modelo = new DOMParser().parseFromString(await zip.file("3D/3dmodel.model").async("string"), "application/xml");
    const items = Array.from(modelo.getElementsByTagName("item")).map((it) => it.getAttribute("transform").split(" ").slice(9).map(Number));
    const ps = JSON.parse(await zip.file("Metadata/project_settings.config").async("string"));
    const partesExp = partesParaExportar(); let ez0 = 1e9, ez1 = -1e9, ex = [1e9, -1e9], ey = [1e9, -1e9];
    partesExp.forEach((q) => { const p = q.geo.attributes.position; for (let i = 0; i < p.count; i++){ ez0 = Math.min(ez0, p.getZ(i)); ez1 = Math.max(ez1, p.getZ(i)); ex[0] = Math.min(ex[0], p.getX(i)); ex[1] = Math.max(ex[1], p.getX(i)); ey[0] = Math.min(ey[0], p.getY(i)); ey[1] = Math.max(ey[1], p.getY(i)); } });
    return { islas: comprobarUniones().n, d, sueltas, vol, colgando, caja: b, zTope, esquina: [esquina.y, esquina.z], suelo: [GEOS.base.ranura.fondoAtras[0], GEOS.base.ranura.fondoAtras[1]], frenteBase: GEOS.base.yFrente,
      rx: grupo.rotation.x, wz0, bz0, bz1, hayMalla: !!mallaBase && mallaBase.visible, mesa: mesa.visible, est, txt, objs, items, torre: [Number(ps.wipe_tower_x[0]), Number(ps.wipe_tower_y[0])], ez0, ez1, topper: [ex[1] - ex[0], ey[1] - ey[0]],
      nPal: GEOS.d2.nPalitos, relOff: $("#relieve").disabled, holgVis: !!document.getElementById("holgura").offsetParent, nota: document.getElementById("apoyoNota").textContent, anchoRanura: GEOS.base.ranura.ancho, largoRanura: GEOS.base.ranura.largo };
  });
  if (!ok(!!r, forma + ": con Base encajable hay datos de apoyo y una base")) continue;
  const con = await huella(page);
  ok(r.islas === islasSin && mismaHuella(con, sin, ["placa", "altoMm", "borde"]), forma + ": el topper sigue en una pieza y el diseño no cambia");
  ok(Math.abs(con.placa.bbox[1] - r.d.yFondo) < 0.02 && Math.abs(r.d.yBase - r.d.yFondo - 10) < 1e-6 && r.d.x1 - r.d.x0 >= 40, forma + ": el topper gana una lengüeta recta de 10 mm (" + (r.d.x1 - r.d.x0).toFixed(0) + " mm de ancho)");
  ok(Math.abs(r.zTope - 4) < 1e-6 && !r.relOff && Math.abs(r.ez0) < 1e-6 && Math.abs(r.ez1 - 4) < 1e-4, forma + ": el topper se imprime normal, boca arriba y con relieve");
  ok(r.sueltas === 0 && r.vol > 3000 && r.colgando < 0.5 && Math.abs(r.caja[2]) < 1e-6 && Math.abs(r.caja[5] - 14) < 1e-4, forma + ": la base es una malla cerrada de 14 mm de alto, sin voladizos (" + (r.vol / 1000).toFixed(1) + " cm³)");
  ok(Math.abs(r.anchoRanura - 3.2) < 1e-6 && Math.abs(r.largoRanura - (r.d.x1 - r.d.x0) - 0.4) < 1e-6, forma + ": ranura de " + r.anchoRanura.toFixed(2) + " mm (grosor 3 + holgura 0,2) y " + r.largoRanura.toFixed(1) + " mm de largo");
  ok(Math.abs(r.rx - (Math.PI / 2 - 10 * Math.PI / 180)) < 1e-6 && Math.abs(r.esquina[0] - (r.frenteBase + r.suelo[0])) < 0.2 && Math.abs(r.esquina[1] - r.suelo[1]) < 0.2, forma + ": en la vista el topper queda metido en la ranura, inclinado 10° hacia atrás");
  ok(r.hayMalla && r.mesa && Math.abs(r.bz0) < 1e-4 && Math.abs(r.bz1 - 14) < 1e-3 && r.wz0 > 1, forma + ": la base se ve sobre la mesa y el topper no la atraviesa (parte más baja del topper a " + r.wz0.toFixed(1) + " mm)");
  ok(r.est.adelante >= 15 && r.est.atras >= 20, forma + ": aguanta " + r.est.adelante.toFixed(1) + "° hacia adelante y " + r.est.atras.toFixed(1) + "° hacia atrás");
  ok(r.objs.length === 2 && r.objs[1].nombre === "Base" && r.objs[1].ext === "1" && r.objs[1].partes.join() === "Base=1" && r.objs[0].partes[0] === "Placa=1", forma + ": el proyecto trae dos objetos: el topper y la «Base» con el filamento de la placa");
  const [it, ib] = r.items, bw = r.caja[3] - r.caja[0], bd = r.caja[4] - r.caja[1];
  const caja = (c, w, h) => [c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2], choca = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
  const cT = caja(it, r.topper[0], r.topper[1]), cB = caja(ib, bw, bd), cW = [r.torre[0], r.torre[1], r.torre[0] + 60, r.torre[1] + 70];
  ok(r.items.length === 2 && !choca(cT, cB) && !choca(cB, cW) && !choca(cT, cW) && cB[0] >= 25 && cB[2] <= 325 && cB[1] >= 0 && cB[3] <= 310 && ib[2] === 0, forma + ": en la cama no se enciman el topper, la base ni la torre de purga");
  ok(/Base encajable/.test(r.txt) && /2 piezas/.test(r.txt) && new RegExp("aguanta " + Math.round(r.est.adelante) + "° hacia adelante y " + Math.round(r.est.atras) + "° hacia atrás").test(r.txt), forma + ": el resumen lo explica");
  ok(r.nPal === 0 && r.holgVis && /dos piezas|2 piezas/i.test(r.nota), forma + ": sin palitos, campo de holgura visible y aviso: «" + r.nota + "»");
  filas.push(forma + " " + r.est.adelante.toFixed(1) + "/" + r.est.atras.toFixed(1));
}
console.log("  aguante adelante/atrás (grados): " + filas.join(" · "));

// holgura: cambia el ancho de la ranura y se guarda
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "base", holgura: "0.4" } }));
ok(await page.evaluate(() => Math.abs(GEOS.base.ranura.ancho - 3.4) < 1e-6 && estadoDiseno().campos.holgura === "0.4" && estadoDiseno().campos.apoyo === "base" && estadoDiseno().palitos === false), "holgura 0,4: ranura de 3,4 mm, y se guarda con el diseño");
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "base", grosor: "4" } }));
ok(await page.evaluate(() => Math.abs(GEOS.base.ranura.ancho - 4.2) < 1e-6 && $("#holgura").value === "0.2"), "un diseño sin holgura guardada usa 0,2; con grosor 4 la ranura mide 4,2");
// ZIP de STL: incluye la base
await page.evaluate(() => abrirExportar());
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnStl")]);
const tmp = path.join(RAIZ, ".superpowers", "stl-base.zip"); await dl.saveAs(tmp);
const nombres = await page.evaluate(async (b64) => Object.keys((await JSZip.loadAsync(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).files).sort(), fs.readFileSync(tmp).toString("base64")); fs.unlinkSync(tmp);
ok(nombres.some((n) => /-base\.stl$/.test(n)) && nombres.length === 3, "ZIP de STL: placa, texto y la base: " + nombres.join(", "));
// con palitos y con solapa: sin base
let iguales = 0;
for (const forma of FORMAS){ await aplicar(page, disenoForma(forma, true)); if (mismaHuella(await huella(page), base["forma:" + forma + ":palitos"])) iguales++; }
ok(iguales === 5 && await page.evaluate(() => !GEOS.base && !scene.children.some((m) => m.userData && m.userData.rol === "base" && m.visible) && !document.getElementById("holgura").offsetParent), "con palitos todo sigue igual (" + iguales + "/5), sin base ni campo de holgura");
await aplicar(page, disenoForma("rect", false, { campos: { apoyo: "solapa" } }));
ok(await page.evaluate(async () => { const z = await JSZip.loadAsync(await construir3mf()); const t = await z.file("Metadata/model_settings.config").async("string"); return !GEOS.base && t.split("<object ").length - 1 === 1 && GEOS.piezas.some((p) => p.nombre === "Solapa"); }), "la solapa de una pieza sigue funcionando (un solo objeto, sin base)");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
