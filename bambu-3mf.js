/* OiMira Toppers - proyecto de Bambu Studio (3MF): una pieza con partes, cada parte con su filamento.
   Formato copiado de un proyecto real guardado con Bambu Studio 02.09.01.70 (ver docs/superpowers/notas/2026-11-22-bambu-cli.md). */

/* ---------- Purga entre colores ---------- */
// Volumen de purga (mm3) al pasar del color `desde` al color `hacia`. Formula de Bambu Studio (FlushVolCalc);
// volBoquilla = volumen de la boquilla (nozzle_volume), que se suma siempre.
function colorRgb(hex){
  var h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h.slice(0, 6), 16); if (!(h.length >= 6) || isNaN(n)) n = 0;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function colorNorm(hex){
  var c = colorRgb(hex);
  return "#" + c.map(function(x){ return ("0" + Math.round(x * 255).toString(16)).slice(-2); }).join("").toUpperCase();
}
function volumenPurga(desde, hacia, volBoquilla){
  function hsv(c){
    var mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), d = mx - mn, h = 0;
    if (d > 0){
      if (mx === c[0]) h = 60 * (((c[1] - c[2]) / d) % 6);
      else if (mx === c[1]) h = 60 * ((c[2] - c[0]) / d + 2);
      else h = 60 * ((c[0] - c[1]) / d + 4);
    }
    if (h < 0) h += 360;
    return [h, mx > 0 ? d / mx : 0, mx];
  }
  function lumi(c){ return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
  var a = colorRgb(desde), b = colorRgb(hacia), ha = hsv(a), hb = hsv(b), rad = Math.PI / 180;
  var dx = Math.cos(ha[0] * rad) * ha[1] * ha[2] - Math.cos(hb[0] * rad) * hb[1] * hb[2];
  var dy = Math.sin(ha[0] * rad) * ha[1] * ha[2] - Math.sin(hb[0] * rad) * hb[1] * hb[2];
  var tono = Math.min(1.2, Math.sqrt(dx * dx + dy * dy));
  var la = lumi(a), lb = lumi(b), flLumi;
  if (lb >= la) flLumi = Math.pow(lb - la, 0.7) * 560;            // oscuro -> claro: cuesta mucho
  else { flLumi = (la - lb) * 80; tono = Math.min(0.67 * hb[2] + 0.33 * ha[2], tono); } // claro -> oscuro: poco
  var flTono = 230 * tono;
  var v = Math.sqrt(flTono * flTono + flLumi * flLumi - 2 * flTono * flLumi * Math.cos(120 * rad));
  v = Math.max(v, 60) + (volBoquilla === undefined ? 130 : volBoquilla);
  return Math.min(Math.floor(v + 1e-6), 900);
}

/* ---------- Plantilla de ajustes -> N filamentos ---------- */
// Devuelve una copia de `perfilBase` (project_settings.config de 1 filamento) con un filamento por color.
function expandirPerfil(perfilBase, colores, ajustes){
  var p = JSON.parse(JSON.stringify(perfilBase)), n = colores.length, C = window.BAMBU_CLAVES;
  function rep(lista){ var o = []; for (var i = 0; i < n; i++) o = o.concat(lista); return o; }
  C.porFilamento.forEach(function(k){ if (Array.isArray(p[k])) p[k] = rep(perfilBase[k]); });
  C.porFilamentoVariante.forEach(function(k){ if (Array.isArray(p[k])) p[k] = rep(perfilBase[k]); });
  var cols = colores.map(colorNorm);
  p.filament_colour = cols.slice(); p.filament_multi_colour = cols.slice();
  var idx = []; for (var i = 0; i < n; i++) idx.push(String(i + 1), String(i + 1), String(i + 1));
  p.filament_self_index = idx;
  p.flush_volumes_vector = rep(perfilBase.flush_volumes_vector);
  // un bloque NxN por boquilla (orden desde -> hacia); el volumen de cada boquilla sale de nozzle_volume
  var ids = perfilBase.printer_extruder_id || [], vols = [], vistos = {};
  ids.forEach(function(id, j){ if (!vistos[id]){ vistos[id] = 1; vols.push(Number(perfilBase.nozzle_volume[j])); } });
  if (!vols.length) vols = [Number((perfilBase.nozzle_volume || ["130"])[0])];
  var m = [];
  vols.forEach(function(vb){
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) m.push(a === b ? "0" : String(volumenPurga(cols[a], cols[b], vb)));
  });
  p.flush_volumes_matrix = m;
  Object.keys(ajustes || {}).forEach(function(k){ p[k] = ajustes[k]; });
  return p;
}

/* ---------- Filamentos del proyecto ---------- */
// Parte = { nombre, color:"#rrggbb", geo: THREE.BufferGeometry }. La placa es siempre partes[0].
// Devuelve los colores sin repetir (en orden de aparicion) y el numero de filamento (desde 1) de cada parte.
function filamentosDe(partes){
  var colores = [], deParte = [];
  partes.forEach(function(p){
    var c = colorNorm(p.color), i = colores.indexOf(c);
    if (i < 0){ colores.push(c); i = colores.length - 1; }
    deParte.push(i + 1);
  });
  return { colores: colores, deParte: deParte };
}

/* ---------- Escritor del proyecto ---------- */
function xmlEsc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function uuidDe(grupo, i){ // forma valida y estable: mismo archivo -> mismos UUID
  function h(n, l){ return ("00000000" + n.toString(16)).slice(-l); }
  return h(grupo, 4) + h(i, 4) + "-0a1b-4c03-9d28-" + h(0x70bbe5 + grupo, 6) + h(i + 1, 6);
}
// Vertices soldados (3 decimales) y triangulos de una geometria, desplazada por (dx, dy, dz).
function mallaSoldada(geo, dx, dy, dz){
  var pos = geo.attributes.position, idx = geo.index, mapa = new Map(), verts = [], tris = [];
  function vid(i){
    var x = (pos.getX(i) + dx).toFixed(3), y = (pos.getY(i) + dy).toFixed(3), z = (pos.getZ(i) + dz).toFixed(3);
    if (x === "-0.000") x = "0.000"; if (y === "-0.000") y = "0.000"; if (z === "-0.000") z = "0.000";
    var k = x + "," + y + "," + z, id = mapa.get(k);
    if (id === undefined){ id = verts.length; mapa.set(k, id); verts.push('<vertex x="' + x + '" y="' + y + '" z="' + z + '"/>'); }
    return id;
  }
  var n = idx ? idx.count : pos.count;
  for (var i = 0; i < n; i += 3){
    var a = vid(idx ? idx.getX(i) : i), b = vid(idx ? idx.getX(i + 1) : i + 1), c = vid(idx ? idx.getX(i + 2) : i + 2);
    if (a !== b && b !== c && a !== c) tris.push('<triangle v1="' + a + '" v2="' + b + '" v3="' + c + '"/>');
  }
  return { verts: verts, tris: tris };
}
// Proyecto de Bambu Studio: UNA pieza con una parte por elemento de `partes`, cada parte con su filamento,
// y la lista de filamentos (colores) en los ajustes del proyecto. Devuelve Promise<Blob>.
function construirProyectoBambu(o){
  var partes = (o.partes || []).filter(function(p){ return p.geo && p.geo.attributes && p.geo.attributes.position && p.geo.attributes.position.count >= 3; });
  var fil = filamentosDe(partes), n = partes.length, idCont = n + 1, titulo = xmlEsc(o.titulo || "topper");
  var VER = "02.09.01.70", cab = '<?xml version="1.0" encoding="UTF-8"?>\n';
  var NS = 'unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"';
  // recuadro del conjunto: centro XY al origen y apoyo en z = 0
  var x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  partes.forEach(function(p){
    var a = p.geo.attributes.position;
    for (var i = 0; i < a.count; i++){
      var x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z;
    }
  });
  var dx = -(x0 + x1) / 2, dy = -(y0 + y1) / 2, dz = -z0;
  var mallas = partes.map(function(p){ return mallaSoldada(p.geo, dx, dy, dz); });
  var hoy = new Date().toISOString().slice(0, 10), ID = "1 0 0 0 1 0 0 0 1 0 0 0";

  var objetos = cab + '<model ' + NS + '>\n <metadata name="BambuStudio:3mfVersion">1</metadata>\n <resources>\n' +
    mallas.map(function(m, i){
      return '  <object id="' + (i + 1) + '" p:UUID="' + uuidDe(1, i) + '" type="model">\n   <mesh>\n    <vertices>' + m.verts.join("") + '</vertices>\n    <triangles>' + m.tris.join("") + '</triangles>\n   </mesh>\n  </object>\n';
    }).join("") + ' </resources>\n</model>\n';

  var metas = [["Application", "BambuStudio-" + VER], ["BambuStudio:3mfVersion", "1"], ["Copyright", ""], ["CreationDate", hoy], ["Description", ""], ["Designer", ""],
    ["DesignerCover", ""], ["DesignerUserId", ""], ["License", ""], ["ModificationDate", hoy], ["Origin", ""], ["ProfileCover", ""], ["ProfileDescription", ""], ["ProfileTitle", ""], ["Title", o.titulo || "topper"]];
  var modelo = cab + '<model ' + NS + '>\n' + metas.map(function(m){ return ' <metadata name="' + m[0] + '">' + xmlEsc(m[1]) + '</metadata>\n'; }).join("") +
    ' <resources>\n  <object id="' + idCont + '" p:UUID="' + uuidDe(2, 0) + '" type="model">\n   <components>\n' +
    partes.map(function(p, i){ return '    <component p:path="/3D/Objects/object_1.model" objectid="' + (i + 1) + '" p:UUID="' + uuidDe(3, i) + '" transform="' + ID + '"/>\n'; }).join("") +
    '   </components>\n  </object>\n </resources>\n <build p:UUID="' + uuidDe(4, 0) + '">\n  <item objectid="' + idCont + '" p:UUID="' + uuidDe(5, 0) + '" transform="1 0 0 0 1 0 0 0 1 175 160 0" printable="1"/>\n </build>\n</model>\n';

  var carasTot = mallas.reduce(function(s, m){ return s + m.tris.length; }, 0);
  var ajustesModelo = cab + '<config>\n  <object id="' + idCont + '">\n    <metadata key="name" value="' + titulo + '"/>\n    <metadata key="extruder" value="1"/>\n    <metadata face_count="' + carasTot + '"/>\n' +
    partes.map(function(p, i){
      return '    <part id="' + (i + 1) + '" subtype="normal_part">\n      <metadata key="name" value="' + xmlEsc(p.nombre) + '"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n' +
        '      <metadata key="extruder" value="' + fil.deParte[i] + '"/>\n' +
        '      <mesh_stat face_count="' + mallas[i].tris.length + '" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n    </part>\n';
    }).join("") +
    '  </object>\n  <plate>\n    <metadata key="plater_id" value="1"/>\n    <metadata key="plater_name" value=""/>\n    <metadata key="locked" value="false"/>\n    <metadata key="filament_map_mode" value="Auto For Flush"/>\n' +
    '    <model_instance>\n      <metadata key="object_id" value="' + idCont + '"/>\n      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="' + (100 + idCont) + '"/>\n    </model_instance>\n  </plate>\n  <assemble>\n' +
    '   <assemble_item object_id="' + idCont + '" instance_id="0" transform="' + ID + '" offset="0 0 0" />\n' +
    partes.map(function(p, i){ return '   <assemble_item object_id="' + idCont + '" volume_id="' + i + '" transform="' + ID + '" />\n'; }).join("") +
    '  </assemble>\n</config>\n';

  var zip = new JSZip();
  zip.file("[Content_Types].xml", cab + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n <Default Extension="png" ContentType="image/png"/>\n <Default Extension="gcode" ContentType="text/x.gcode"/>\n</Types>\n');
  zip.file("_rels/.rels", cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n');
  zip.file("3D/3dmodel.model", modelo);
  zip.file("3D/_rels/3dmodel.model.rels", cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n');
  zip.file("3D/Objects/object_1.model", objetos);
  zip.file("Metadata/model_settings.config", ajustesModelo);
  zip.file("Metadata/project_settings.config", JSON.stringify(expandirPerfil(o.perfilBase, fil.colores, o.ajustes || {}), null, 4));
  zip.file("Metadata/slice_info.config", cab + '<config>\n  <header>\n    <header_item key="X-BBL-Client-Type" value="slicer"/>\n    <header_item key="X-BBL-Client-Version" value="' + VER + '"/>\n  </header>\n</config>\n');
  zip.file("Metadata/cut_information.xml", '<?xml version="1.0" encoding="utf-8"?>\n<objects>\n <object id="1">\n  <cut_id id="0" check_sum="1" connectors_cnt="0"/>\n </object>\n</objects>\n');
  zip.file("Metadata/filament_sequence.json", '{"plate_1":{"nozzle_sequence":[],"optimal_assignment":[],"sequence":[]}}');
  return zip.generateAsync({ type: "blob", mimeType: "model/3mf", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
