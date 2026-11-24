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
  // Ajustes de proceso encima de la plantilla. Bambu Studio parte del perfil del sistema (print_settings_id) y solo
  // respeta los cambios que se declaran en different_settings_to_system: [proceso, un hueco por filamento, impresora].
  var cambiados = Object.keys(ajustes || {});
  cambiados.forEach(function(k){ p[k] = ajustes[k]; });
  var huecos = []; for (var h = 0; h < n + 2; h++) huecos.push("");
  p.different_settings_to_system = huecos.slice(); p.different_settings_to_system[0] = cambiados.join(";");
  p.inherits_group = huecos.slice();
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
  // extras: objetos aparte que van en la misma cama (por ejemplo la base encajable); cada uno es un objeto de una sola parte
  var extras = (o.extras || []).filter(function(p){ return p.geo && p.geo.attributes && p.geo.attributes.position && p.geo.attributes.position.count >= 3; });
  var fil = filamentosDe(partes.concat(extras)), n = partes.length, idCont = n + 1, titulo = xmlEsc(o.titulo || "topper");
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
  // Colocacion en la cama de la H2D (350 x 320; util para las dos boquillas: x de 25 a 325; al fondo, zona excluida
  // desde y = 310). La pieza va centrada a lo ancho y hacia el frente, y la torre de purga 25 mm detras (se le dejan
  // 70 mm de fondo). Si no cabe detras, a la derecha; si tampoco, pieza al centro y torre donde la trae el perfil.
  var anchoP = x1 - x0, altoP = y1 - y0, objY = 160, torre = null;
  function n3(v){ return String(+v.toFixed(3)); }
  if (14 + altoP + 25 + 70 <= 308){ objY = 14 + altoP / 2; torre = [145, 14 + altoP + 25]; }
  else if (175 + anchoP / 2 + 25 + 60 <= 325 && 14 + altoP <= 308){ objY = 14 + altoP / 2; torre = [175 + anchoP / 2 + 25, 120]; }
  var mallas = partes.map(function(p){ return mallaSoldada(p.geo, dx, dy, dz); });
  // Cada extra: malla centrada en su propio recuadro y apoyada en z = 0; ids = malla idCont+1+2k, objeto idCont+2+2k.
  var ex = extras.map(function(p, k){
    var a = p.geo.attributes.position, b = [Infinity, Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < a.count; i++){
      var x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y;
    }
    return { nombre: p.nombre, ext: fil.deParte[n + k], idMalla: idCont + 1 + 2 * k, idObj: idCont + 2 + 2 * k, ancho: b[3] - b[0], fondo: b[4] - b[1],
             malla: mallaSoldada(p.geo, -(b[0] + b[3]) / 2, -(b[1] + b[4]) / 2, -b[2]), pos: null, girado: false };
  });
  // Con un extra (la base encajable): si queda sitio detras del topper, base y torre de purga van en esa fila, lado a
  // lado. Si el topper es alto, el conjunto se arma en dos columnas: el topper a la izquierda y, a su derecha, la base
  // (girada si hace falta) con la torre detras. Si nada cabe (topper enorme), la base queda a la derecha y Bambu Studio
  // avisara del choque: toca reacomodar a mano.
  var objX = 175;
  if (ex.length){
    var e0 = ex[0], filaY = 14 + altoP + 25, SEP = 15;
    objY = 14 + altoP / 2; torre = null;
    if (filaY + Math.max(70, e0.fondo) <= 308 && e0.ancho + SEP + 60 <= 300){
      var xr = 175 - (e0.ancho + SEP + 60) / 2;
      e0.pos = [xr + e0.ancho / 2, filaY + e0.fondo / 2]; torre = [xr + e0.ancho + SEP, filaY];
    } else {
      var libre = 300 - anchoP - SEP;
      e0.girado = !(e0.ancho <= libre) && e0.fondo <= libre;
      var bw = e0.girado ? e0.fondo : e0.ancho, bd = e0.girado ? e0.ancho : e0.fondo, col = Math.max(bw, 60);
      var xi = Math.max(25, 175 - (anchoP + SEP + col) / 2);
      objX = xi + anchoP / 2;
      e0.pos = [xi + anchoP + SEP + bw / 2, 14 + bd / 2];
      torre = [xi + anchoP + SEP, 14 + bd + SEP];
    }
    for (var q = 1; q < ex.length; q++) ex[q].pos = [e0.pos[0], ex[q - 1].pos[1] + ex[q - 1].fondo / 2 + 10 + ex[q].fondo / 2];
  }
  var hoy = new Date().toISOString().slice(0, 10), ID = "1 0 0 0 1 0 0 0 1 0 0 0";

  var objetos = cab + '<model ' + NS + '>\n <metadata name="BambuStudio:3mfVersion">1</metadata>\n <resources>\n' +
    mallas.map(function(m, i){
      return '  <object id="' + (i + 1) + '" p:UUID="' + uuidDe(1, i) + '" type="model">\n   <mesh>\n    <vertices>' + m.verts.join("") + '</vertices>\n    <triangles>' + m.tris.join("") + '</triangles>\n   </mesh>\n  </object>\n';
    }).join("") +
    ex.map(function(e, k){
      return '  <object id="' + e.idMalla + '" p:UUID="' + uuidDe(1, n + k) + '" type="model">\n   <mesh>\n    <vertices>' + e.malla.verts.join("") + '</vertices>\n    <triangles>' + e.malla.tris.join("") + '</triangles>\n   </mesh>\n  </object>\n';
    }).join("") + ' </resources>\n</model>\n';

  var metas = [["Application", "BambuStudio-" + VER], ["BambuStudio:3mfVersion", "1"], ["Copyright", ""], ["CreationDate", hoy], ["Description", ""], ["Designer", ""],
    ["DesignerCover", ""], ["DesignerUserId", ""], ["License", ""], ["ModificationDate", hoy], ["Origin", ""], ["ProfileCover", ""], ["ProfileDescription", ""], ["ProfileTitle", ""], ["Title", o.titulo || "topper"]];
  var modelo = cab + '<model ' + NS + '>\n' + metas.map(function(m){ return ' <metadata name="' + m[0] + '">' + xmlEsc(m[1]) + '</metadata>\n'; }).join("") +
    ' <resources>\n  <object id="' + idCont + '" p:UUID="' + uuidDe(2, 0) + '" type="model">\n   <components>\n' +
    partes.map(function(p, i){ return '    <component p:path="/3D/Objects/object_1.model" objectid="' + (i + 1) + '" p:UUID="' + uuidDe(3, i) + '" transform="' + ID + '"/>\n'; }).join("") +
    '   </components>\n  </object>\n' +
    ex.map(function(e, k){
      return '  <object id="' + e.idObj + '" p:UUID="' + uuidDe(2, 1 + k) + '" type="model">\n   <components>\n    <component p:path="/3D/Objects/object_1.model" objectid="' + e.idMalla + '" p:UUID="' + uuidDe(3, n + k) + '" transform="' + ID + '"/>\n   </components>\n  </object>\n';
    }).join("") +
    ' </resources>\n <build p:UUID="' + uuidDe(4, 0) + '">\n  <item objectid="' + idCont + '" p:UUID="' + uuidDe(5, 0) + '" transform="1 0 0 0 1 0 0 0 1 ' + n3(objX) + ' ' + n3(objY) + ' 0" printable="1"/>\n' +
    ex.map(function(e, k){
      return '  <item objectid="' + e.idObj + '" p:UUID="' + uuidDe(5, 1 + k) + '" transform="' + (e.girado ? "0 1 0 -1 0 0 0 0 1 " : "1 0 0 0 1 0 0 0 1 ") + n3(e.pos[0]) + ' ' + n3(e.pos[1]) + ' 0" printable="1"/>\n';
    }).join("") + ' </build>\n</model>\n';

  var carasTot = mallas.reduce(function(s, m){ return s + m.tris.length; }, 0);
  var ajustesModelo = cab + '<config>\n  <object id="' + idCont + '">\n    <metadata key="name" value="' + titulo + '"/>\n    <metadata key="extruder" value="1"/>\n    <metadata face_count="' + carasTot + '"/>\n' +
    partes.map(function(p, i){
      return '    <part id="' + (i + 1) + '" subtype="normal_part">\n      <metadata key="name" value="' + xmlEsc(p.nombre) + '"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n' +
        '      <metadata key="extruder" value="' + fil.deParte[i] + '"/>\n' +
        '      <mesh_stat face_count="' + mallas[i].tris.length + '" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n    </part>\n';
    }).join("") +
    '  </object>\n' +
    ex.map(function(e){
      return '  <object id="' + e.idObj + '">\n    <metadata key="name" value="' + xmlEsc(e.nombre) + '"/>\n    <metadata key="extruder" value="' + e.ext + '"/>\n    <metadata face_count="' + e.malla.tris.length + '"/>\n' +
        '    <part id="' + e.idMalla + '" subtype="normal_part">\n      <metadata key="name" value="' + xmlEsc(e.nombre) + '"/>\n      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n      <metadata key="extruder" value="' + e.ext + '"/>\n' +
        '      <mesh_stat face_count="' + e.malla.tris.length + '" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n    </part>\n  </object>\n';
    }).join("") +
    '  <plate>\n    <metadata key="plater_id" value="1"/>\n    <metadata key="plater_name" value=""/>\n    <metadata key="locked" value="false"/>\n    <metadata key="filament_map_mode" value="Auto For Flush"/>\n' +
    [idCont].concat(ex.map(function(e){ return e.idObj; })).map(function(id){
      return '    <model_instance>\n      <metadata key="object_id" value="' + id + '"/>\n      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="' + (100 + id) + '"/>\n    </model_instance>\n';
    }).join("") + '  </plate>\n  <assemble>\n' +
    '   <assemble_item object_id="' + idCont + '" instance_id="0" transform="' + ID + '" offset="0 0 0" />\n' +
    partes.map(function(p, i){ return '   <assemble_item object_id="' + idCont + '" volume_id="' + i + '" transform="' + ID + '" />\n'; }).join("") +
    ex.map(function(e){ return '   <assemble_item object_id="' + e.idObj + '" instance_id="0" transform="' + ID + '" offset="0 0 0" />\n'; }).join("") +
    '  </assemble>\n</config>\n';

  var zip = new JSZip();
  zip.file("[Content_Types].xml", cab + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n <Default Extension="png" ContentType="image/png"/>\n <Default Extension="gcode" ContentType="text/x.gcode"/>\n</Types>\n');
  zip.file("_rels/.rels", cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n');
  zip.file("3D/3dmodel.model", modelo);
  zip.file("3D/_rels/3dmodel.model.rels", cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n');
  zip.file("3D/Objects/object_1.model", objetos);
  zip.file("Metadata/model_settings.config", ajustesModelo);
  var ajustesProyecto = expandirPerfil(o.perfilBase, fil.colores, o.ajustes || {});
  if (torre){ ajustesProyecto.wipe_tower_x = [n3(torre[0])]; ajustesProyecto.wipe_tower_y = [n3(torre[1])]; }
  zip.file("Metadata/project_settings.config", JSON.stringify(ajustesProyecto, null, 4));
  zip.file("Metadata/slice_info.config", cab + '<config>\n  <header>\n    <header_item key="X-BBL-Client-Type" value="slicer"/>\n    <header_item key="X-BBL-Client-Version" value="' + VER + '"/>\n  </header>\n</config>\n');
  zip.file("Metadata/cut_information.xml", '<?xml version="1.0" encoding="utf-8"?>\n<objects>\n' + [0].concat(ex.map(function(e, k){ return k + 1; })).map(function(k){ return ' <object id="' + (k + 1) + '">\n  <cut_id id="0" check_sum="1" connectors_cnt="0"/>\n </object>\n'; }).join("") + '</objects>\n');
  zip.file("Metadata/filament_sequence.json", '{"plate_1":{"nozzle_sequence":[],"optimal_assignment":[],"sequence":[]}}');
  return zip.generateAsync({ type: "blob", mimeType: "model/3mf", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
