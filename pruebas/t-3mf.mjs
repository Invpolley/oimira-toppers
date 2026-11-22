// Escritor del proyecto Bambu: estructura del 3MF, filamento por parte, colores sin repetir.
import { abrirApp, ok, fin } from "./lib.mjs";
const { page, cerrar, errores } = await abrirApp();
for (const f of ["bambu-perfil-data.js", "bambu-3mf.js"])
  if (!(await page.evaluate((f) => !!document.querySelector('script[src^="' + f + '"]'), f))) await page.addScriptTag({ url: f });
const hay = await page.evaluate(() => typeof construirProyectoBambu === "function" && typeof filamentosDe === "function");
if (!ok(hay, "existen construirProyectoBambu y filamentosDe")){ await cerrar(); fin(); }

const r = await page.evaluate(async () => {
  function caja(x, y, z, w, h, d){ const g = new THREE.BoxGeometry(w, h, d); g.translate(x + w / 2, y + h / 2, z + d / 2); return g; }
  const partes = [
    { nombre: "Placa", color: "#f5f5f5", geo: caja(10, 20, 5, 40, 30, 3) },
    { nombre: "Texto <1>", color: "#D32F2F", geo: caja(20, 30, 8, 10, 10, 1) },
    { nombre: "Borde", color: "#F5F5F5", geo: caja(12, 22, 8, 4, 4, 1) },
    { nombre: "Vacía", color: "#00ff00", geo: new THREE.BufferGeometry() },
  ];
  const fil = filamentosDe(partes.slice(0, 3));
  const fil3 = filamentosDe([{ color: "#abc" }, { color: "#AABBCC" }, { color: "#1c1c1c" }]);
  const blob = await construirProyectoBambu({ titulo: 'Feliz & "Cía" <3', partes, perfilBase: BAMBU_PERFIL, ajustes: {} });
  const zip = await JSZip.loadAsync(blob);
  const rutas = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
  const txt = {}; for (const n of rutas) txt[n] = await zip.file(n).async("string");
  const xml = (n) => new DOMParser().parseFromString(txt[n], "application/xml");
  const malo = (n) => !txt[n] || xml(n).getElementsByTagName("parsererror").length > 0;
  const ms = xml("Metadata/model_settings.config"), modelo = xml("3D/3dmodel.model"), obj = xml("3D/Objects/object_1.model");
  const meta = (el, k) => { const m = Array.from(el.children).filter((c) => c.tagName === "metadata" && c.getAttribute("key") === k)[0]; return m ? m.getAttribute("value") : null; };
  const partesXml = Array.from(ms.getElementsByTagName("part"));
  const verts = Array.from(obj.getElementsByTagName("vertex"));
  const zs = verts.map((v) => +v.getAttribute("z")), xs = verts.map((v) => +v.getAttribute("x")), ys = verts.map((v) => +v.getAttribute("y"));
  const ps = JSON.parse(txt["Metadata/project_settings.config"]);
  const objetos = Array.from(obj.getElementsByTagName("object"));
  const tri0 = objetos[0].getElementsByTagName("triangle").length, v0 = objetos[0].getElementsByTagName("vertex").length;
  const metaModelo = {}; Array.from(modelo.getElementsByTagName("metadata")).forEach((m) => { metaModelo[m.getAttribute("name")] = m.textContent; });
  const item = modelo.getElementsByTagName("item")[0], cont = Array.from(modelo.getElementsByTagName("object"))[0];
  return {
    fil, fil3, rutas, tipo: blob.type,
    malos: ["3D/3dmodel.model", "3D/Objects/object_1.model", "Metadata/model_settings.config", "[Content_Types].xml", "_rels/.rels", "3D/_rels/3dmodel.model.rels", "Metadata/slice_info.config", "Metadata/cut_information.xml"].filter(malo),
    nombres: partesXml.map((p) => meta(p, "name")), ext: partesXml.map((p) => meta(p, "extruder")), ids: partesXml.map((p) => p.getAttribute("id")),
    subtipos: partesXml.map((p) => p.getAttribute("subtype")), matrices: partesXml.map((p) => meta(p, "matrix")),
    caras: partesXml.map((p) => p.getElementsByTagName("mesh_stat")[0].getAttribute("face_count")),
    objMs: ms.getElementsByTagName("object")[0].getAttribute("id"), objExt: meta(ms.getElementsByTagName("object")[0], "extruder"), objNombre: meta(ms.getElementsByTagName("object")[0], "name"),
    modoMapa: meta(ms.getElementsByTagName("plate")[0], "filament_map_mode"),
    instObj: meta(ms.getElementsByTagName("model_instance")[0], "object_id"), nAssemble: ms.getElementsByTagName("assemble_item").length,
    nObjetos: objetos.length, idsObj: objetos.map((o) => o.getAttribute("id")), tri0, v0,
    zmin: Math.min(...zs), zmax: Math.max(...zs), cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    app: metaModelo["Application"], ver: metaModelo["BambuStudio:3mfVersion"], titulo: metaModelo["Title"], tieneUserId: "DesignerUserId" in metaModelo && metaModelo["DesignerUserId"] !== "",
    contId: cont.getAttribute("id"), comps: Array.from(modelo.getElementsByTagName("component")).map((c) => c.getAttribute("objectid") + "|" + c.getAttribute("p:path") + "|" + c.getAttribute("transform")),
    item: item.getAttribute("objectid") + "|" + item.getAttribute("transform") + "|" + item.getAttribute("printable"),
    uuids: (txt["3D/3dmodel.model"] + txt["3D/Objects/object_1.model"]).match(/UUID="[^"]+"/g) || [],
    colores: ps.filament_colour, nFilSet: ps.filament_settings_id.length, matriz: ps.flush_volumes_matrix.length,
    seq: txt["Metadata/filament_sequence.json"], rels: txt["3D/_rels/3dmodel.model.rels"].includes("/3D/Objects/object_1.model"),
  };
});
const ig = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ok(ig(r.fil.colores, ["#F5F5F5", "#D32F2F"]) && ig(r.fil.deParte, [1, 2, 1]), "colores sin repetir (sin distinguir mayúsculas), placa primero");
ok(ig(r.fil3.colores, ["#AABBCC", "#1C1C1C"]) && ig(r.fil3.deParte, [1, 1, 2]), "#abc es el mismo color que #AABBCC");
ok(ig(r.rutas, ["3D/3dmodel.model", "3D/Objects/object_1.model", "3D/_rels/3dmodel.model.rels", "Metadata/cut_information.xml", "Metadata/filament_sequence.json", "Metadata/model_settings.config", "Metadata/project_settings.config", "Metadata/slice_info.config", "[Content_Types].xml", "_rels/.rels"]), "el zip trae las rutas del proyecto Bambu: " + r.rutas.join(","));
ok(r.malos.length === 0, "todos los XML son válidos: " + r.malos.join(","));
ok(r.app === "BambuStudio-02.09.01.70" && r.ver === "1", "se declara proyecto de Bambu Studio");
ok(r.titulo === 'Feliz & "Cía" <3', "el título con & < \" se conserva (XML escapado)");
ok(!r.tieneUserId, "sin DesignerUserId");
ok(ig(r.nombres, ["Placa", "Texto <1>", "Borde"]), "3 partes (la vacía se omite): " + r.nombres.join(","));
ok(ig(r.ext, ["1", "2", "1"]), "extruder por parte = 1,2,1: " + r.ext.join(","));
ok(ig(r.ids, ["1", "2", "3"]) && r.subtipos.every((s) => s === "normal_part") && r.matrices.every((m) => m === "1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"), "partes normales con matriz identidad");
ok(ig(r.caras, ["12", "12", "12"]) && r.tri0 === 12 && r.v0 === 8, "malla soldada: una caja = 8 vértices y 12 caras");
ok(r.nObjetos === 3 && ig(r.idsObj, ["1", "2", "3"]) && r.contId === "4" && r.objMs === "4" && r.instObj === "4", "objeto contenedor id N+1 con sus 3 mallas");
ok(r.objExt === "1" && r.objNombre === "Feliz & \"Cía\" <3" && r.modoMapa === "Auto For Flush", "objeto: extruder 1, nombre y Auto For Flush");
ok(ig(r.comps, [1, 2, 3].map((k) => k + "|/3D/Objects/object_1.model|1 0 0 0 1 0 0 0 1 0 0 0")), "componentes con transformación identidad");
ok(r.item === "4|1 0 0 0 1 0 0 0 1 175 160 0|1", "la pieza va al centro de la cama (175,160) apoyada en z=0");
ok(Math.abs(r.zmin) < 1e-6 && Math.abs(r.zmax - 4) < 1e-6 && Math.abs(r.cx) < 1e-6 && Math.abs(r.cy) < 1e-6, "malla centrada en XY y con z mínima 0");
ok(r.uuids.length === 9 && new Set(r.uuids).size === 9 && r.uuids.every((u) => /^UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"$/.test(u)), "UUID válidos y distintos: " + r.uuids.length);
ok(ig(r.colores, ["#F5F5F5", "#D32F2F"]) && r.nFilSet === 2 && r.matriz === 8, "ajustes del proyecto con 2 filamentos");
ok(r.nAssemble === 4 && r.rels && JSON.parse(r.seq).plate_1 && r.tipo === "model/3mf", "assemble, relaciones, secuencia y tipo del archivo");
ok(errores.length === 0, "sin errores de página: " + errores.join(" | "));
await cerrar(); fin();
