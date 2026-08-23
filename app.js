// OiMira Toppers — texto + motivo -> placa 3D plana multicolor -> 3MF / STL (Bambu Lab)
var C = window.TP_CONFIG;
var $ = function(s){ return document.querySelector(s); };
document.getElementById("ver").textContent = C.APP_VERSION;

/* ================= Biblioteca de motivos (siempre imprimen bien) ================= */
var BIBLIOTECA = [
  { nombre:"Corazón", paths:["M50 82 L20 52 C8 40 8 22 22 16 C34 11 44 18 50 28 C56 18 66 11 78 16 C92 22 92 40 80 52 Z"] },
  { nombre:"Estrella", paths:["M50 8 L61 38 L93 38 L67 57 L77 88 L50 69 L23 88 L33 57 L7 38 L39 38 Z"] },
  { nombre:"Globos", paths:["M35 12 C20 12 12 24 12 35 C12 48 24 58 35 58 C46 58 58 48 58 35 C58 24 50 12 35 12 Z M33 58 L30 70 L40 70 L37 58 Z","M72 25 C62 25 56 33 56 41 C56 50 64 57 72 57 C80 57 88 50 88 41 C88 33 82 25 72 25 Z M70 57 L68 66 L76 66 L74 57 Z"] },
  { nombre:"Corona", paths:["M12 70 L12 40 L30 52 L50 22 L70 52 L88 40 L88 70 Z M12 74 L88 74 L88 84 L12 84 Z"] },
  { nombre:"Flor", paths:["M50 10 C60 10 64 22 57 29 C70 24 79 33 74 44 C69 54 56 51 52 42 L52 42 C56 51 47 60 37 56 C26 51 29 38 39 35 C29 32 28 19 38 14 C43 11 47 10 50 10 Z","M50 46 C55 46 59 50 59 55 C59 60 55 64 50 64 C45 64 41 60 41 55 C41 50 45 46 50 46 Z"] },
  { nombre:"Mariposa", paths:["M48 45 C40 28 22 15 12 22 C2 30 12 48 28 52 C14 56 6 70 14 79 C24 88 42 72 48 58 Z","M52 45 C60 28 78 15 88 22 C98 30 88 48 72 52 C86 56 94 70 86 79 C76 88 58 72 52 58 Z","M46 40 L54 40 L54 78 L46 78 Z"] },
  { nombre:"Torta", paths:["M20 50 L80 50 L80 85 L20 85 Z M15 46 L85 46 L85 54 L15 54 Z","M47 20 L53 20 L53 36 L47 36 Z M44 36 L56 36 L56 46 L44 46 Z"] },
  { nombre:"Hojas", paths:["M50 15 C50 45 35 60 15 62 C20 40 32 22 50 15 Z","M50 15 C50 45 65 60 85 62 C80 40 68 22 50 15 Z","M47 15 L53 15 L53 85 L47 85 Z"] }
];

/* ================= Estado ================= */
var FUENTES = {}; // nombre -> opentype.Font
var MOTIVO_SEL = null;       // {nombre, paths}
var MOTIVOS_IA = [];
var GEOS = null;             // { placa, texto, motivo } BufferGeometry en mm
var renderTimer = null;

function msgEl(id, t, err){ var el = $("#" + id); el.textContent = t || ""; el.className = "msg " + (err ? "err" : "ok"); }

/* ================= Cargar fuentes ================= */
var FUENTE_URLS = { greatvibes:"fonts/GreatVibes-Regular.ttf", pacifico:"fonts/Pacifico-Regular.ttf", poppins:"fonts/Poppins-SemiBold.ttf" };
function cargarFuente(key){
  if (FUENTES[key]) return Promise.resolve(FUENTES[key]);
  return new Promise(function(res, rej){
    opentype.load(FUENTE_URLS[key], function(err, font){
      if (err || !font) return rej(err || new Error("fuente"));
      FUENTES[key] = font; res(font);
    });
  });
}

/* ================= Conversión de contornos ================= */
// Union booleana (Clipper, regla non-zero): arregla trazos superpuestos de fuentes script
var CLIP_ESC = 100;
function unionRings(rings){
  if (!rings.length) return [];
  var subj = rings.map(function(r){ return r.map(function(p){ return { X: Math.round(p.x * CLIP_ESC), Y: Math.round(p.y * CLIP_ESC) }; }); });
  var c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  var tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  var shapes = [];
  function walk(node){
    (node.Childs() || []).forEach(function(outer){
      var s = new THREE.Shape(outer.Contour().map(function(p){ return new THREE.Vector2(p.X / CLIP_ESC, p.Y / CLIP_ESC); }));
      (outer.Childs() || []).forEach(function(hole){
        s.holes.push(new THREE.Path(hole.Contour().map(function(p){ return new THREE.Vector2(p.X / CLIP_ESC, p.Y / CLIP_ESC); })));
        (hole.Childs() || []).forEach(function(sub){ walk({ Childs: function(){ return [sub]; } }); });
      });
      shapes.push(s);
    });
  }
  walk(tree);
  return shapes;
}
// opentype path -> THREE shapes (y invertida, contornos unidos con Clipper)
function otPathToShapes(otPath){
  var sp = new THREE.ShapePath();
  otPath.commands.forEach(function(c){
    if (c.type === "M") sp.moveTo(c.x, -c.y);
    else if (c.type === "L") sp.lineTo(c.x, -c.y);
    else if (c.type === "C") sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    else if (c.type === "Q") sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
  });
  var rings = sp.subPaths.map(function(p){ return p.getPoints(20); }).filter(function(r){ return r.length > 2; });
  return unionRings(rings);
}
// baked: shape con curvas -> shape poligonal con transform (flip y / escala / offset)
function bakeShape(shape, fx, fy){
  var pts = shape.extractPoints(24);
  function mp(arr){ return arr.map(function(p){ return new THREE.Vector2(fx(p.x), fy(p.y)); }); }
  var s = new THREE.Shape(mp(pts.shape));
  s.holes = (pts.holes || []).map(function(h){ return new THREE.Path(mp(h)); });
  return s;
}
function svgPathsToShapes(paths){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    paths.map(function(d){ return '<path d="' + d + '"/>'; }).join("") + "</svg>";
  var data = new THREE.SVGLoader().parse(svg);
  var rings = [];
  data.paths.forEach(function(p){
    p.subPaths.forEach(function(sp){ var r = sp.getPoints(24); if (r.length > 2) rings.push(r); });
  });
  return unionRings(rings);
}
function shapesBBox(shapes){
  var box = new THREE.Box2(); var v = new THREE.Vector2();
  shapes.forEach(function(s){
    s.extractPoints(12).shape.forEach(function(p){ box.expandByPoint(v.set(p.x, p.y)); });
  });
  return box;
}

/* ================= Construcción del diseño (unidades mm) ================= */
function construir(){
  var font = FUENTES[$("#fuente").value];
  if (!font) return null;
  var lineas = [$("#l1").value.trim(), $("#l2").value.trim(), $("#l3").value.trim()].filter(Boolean);
  if (!lineas.length && !MOTIVO_SEL) return null;
  var anchoMm = Math.max(60, Math.min(220, Number($("#ancho").value) || 140));
  var grosor = Number($("#grosor").value) || 3;
  var relieve = Number($("#relieve").value) || 1.2;

  // --- texto en unidades de fuente (tam 40), apilado y centrado ---
  var SIZE = 40, LH = SIZE * 1.18;
  var textShapes = [];
  var yCursor = 0, maxW = 0, medidas = [];
  lineas.forEach(function(t){
    var w = font.getAdvanceWidth(t, SIZE);
    medidas.push(w); if (w > maxW) maxW = w;
  });
  lineas.forEach(function(t, i){
    var w = medidas[i];
    // por GLIFO (no por linea): evita rellenos rotos en fuentes script con trazos superpuestos
    var gps = font.getPaths(t, -w / 2, yCursor, SIZE);
    gps.forEach(function(gp){ otPathToShapes(gp).forEach(function(s){ textShapes.push(s); }); });
    yCursor += LH;
  });
  // bbox del texto
  var tb = textShapes.length ? shapesBBox(textShapes) : new THREE.Box2(new THREE.Vector2(-1,-1), new THREE.Vector2(1,1));

  // --- motivo arriba del texto ---
  var motShapes = [];
  if (MOTIVO_SEL){
    var raw = svgPathsToShapes(MOTIVO_SEL.paths);
    var mb = shapesBBox(raw);
    var mw = Math.max(mb.max.x - mb.min.x, 1), mh = Math.max(mb.max.y - mb.min.y, 1);
    var target = Math.max(maxW * 0.45, SIZE * 1.2);
    var k = target / mw;
    var mcx = (mb.min.x + mb.max.x) / 2;
    var topY = tb.max.y + mh * k * 0.5 + SIZE * 0.45; // centro del motivo sobre el texto (y-arriba)
    raw.forEach(function(s){
      motShapes.push(bakeShape(s,
        function(x){ return (x - mcx) * k; },
        function(y){ return (y - (mb.min.y + mb.max.y) / 2) * -k + topY; } // flip svg
      ));
    });
  }

  // --- bbox contenido total ---
  var all = textShapes.concat(motShapes);
  var cb = shapesBBox(all);
  var cw = cb.max.x - cb.min.x, ch = cb.max.y - cb.min.y;
  var ccx = (cb.min.x + cb.max.x) / 2, ccy = (cb.min.y + cb.max.y) / 2;

  // --- escala global para que la placa mida anchoMm ---
  var padX = cw * 0.14 + SIZE * 0.25, padY = ch * 0.14 + SIZE * 0.25;
  var plateW = cw + padX * 2, plateH = ch + padY * 2;
  var esc = anchoMm / plateW;
  function T(shapes){
    return shapes.map(function(s){
      return bakeShape(s, function(x){ return (x - ccx) * esc; }, function(y){ return (y - ccy) * esc; }); // ya esta en y-arriba
    });
  }
  var textMm = T(textShapes), motMm = T(motShapes);
  var plateWmm = plateW * esc, plateHmm = plateH * esc;

  // --- placa ---
  var plate = new THREE.Shape();
  if ($("#placa").value === "ovalo"){
    plate.absellipse(0, 0, plateWmm / 2, plateHmm / 2 * 1.06, 0, Math.PI * 2, false, 0);
  } else {
    var r = Math.min(10, plateHmm * 0.2), hw = plateWmm / 2, hh = plateHmm / 2;
    plate.moveTo(-hw + r, -hh);
    plate.lineTo(hw - r, -hh); plate.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
    plate.lineTo(hw, hh - r); plate.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
    plate.lineTo(-hw + r, hh); plate.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
    plate.lineTo(-hw, -hh + r); plate.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  }
  var plateShapes = [plate];
  // palitos
  if ($("#palitos").checked){
    var pl = Number($("#palLen").value) || 45, pw = 6;
    var yBottom = -plateHmm / 2 * ($("#placa").value === "ovalo" ? 0.75 : 0.98);
    [-plateWmm * 0.26, plateWmm * 0.26].forEach(function(px){
      var st = new THREE.Shape();
      st.moveTo(px - pw / 2, yBottom + 6);
      st.lineTo(px + pw / 2, yBottom + 6);
      st.lineTo(px + pw / 2, yBottom - pl + 4);
      st.lineTo(px, yBottom - pl); // punta
      st.lineTo(px - pw / 2, yBottom - pl + 4);
      st.closePath();
      plateShapes.push(st);
    });
  }

  // --- extrusiones ---
  function extr(shapes, depth){
    if (!shapes.length) return null;
    var g = new THREE.ExtrudeGeometry(shapes, { depth: depth, bevelEnabled: false, curveSegments: 18 });
    return g;
  }
  var gPlaca = extr(plateShapes, grosor);
  var gTexto = extr(textMm, relieve); if (gTexto) gTexto.translate(0, 0, grosor);
  var gMot = extr(motMm, relieve); if (gMot) gMot.translate(0, 0, grosor);
  return { placa: gPlaca, texto: gTexto, motivo: gMot, anchoMm: anchoMm, altoMm: plateHmm };
}

/* ================= Vista previa 3D ================= */
var canvas = document.getElementById("vista");
var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
var scene = new THREE.Scene();
var cam = new THREE.PerspectiveCamera(40, 1, 1, 2000);
cam.position.set(0, -140, 160); cam.up.set(0, 0, 1);
var controls = new THREE.OrbitControls(cam, canvas);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
var dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(60, -80, 120); scene.add(dl);
var dl2 = new THREE.DirectionalLight(0xffffff, 0.3); dl2.position.set(-60, 40, 60); scene.add(dl2);
var grupo = new THREE.Group(); scene.add(grupo);

function tamCanvas(){
  var w = canvas.clientWidth || canvas.parentElement.clientWidth, h = 440;
  renderer.setSize(w, h, false);
  cam.aspect = w / h; cam.updateProjectionMatrix();
}
window.addEventListener("resize", function(){ tamCanvas(); });

function refrescar(){
  var b = construir();
  while (grupo.children.length) grupo.remove(grupo.children[0]);
  GEOS = null;
  if (!b) return;
  GEOS = b;
  function add(g, color){
    if (!g) return;
    grupo.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: color, roughness: 0.55, metalness: 0.05 })));
  }
  add(b.placa, $("#c1").value);
  add(b.texto, $("#c2").value);
  add(b.motivo, $("#c3").value);
}
function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene, cam); }

function programarRefresco(){ clearTimeout(renderTimer); renderTimer = setTimeout(refrescar, 350); }
["l1","l2","l3","fuente","placa","ancho","grosor","relieve","palitos","palLen","c1","c2","c3"].forEach(function(id){
  var el = document.getElementById(id);
  el.addEventListener("input", programarRefresco);
  el.addEventListener("change", programarRefresco);
});

/* ================= Motivos: biblioteca + IA ================= */
function pintarMotivos(){
  var todos = MOTIVOS_IA.concat(BIBLIOTECA);
  $("#gridMotivos").innerHTML = '<button class="mot' + (MOTIVO_SEL === null ? " sel" : "") + '" data-i="-1" title="Sin motivo"><svg viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="80" stroke="#ccc" stroke-width="6"/><line x1="80" y1="20" x2="20" y2="80" stroke="#ccc" stroke-width="6"/></svg></button>' +
    todos.map(function(m, i){
      var sel = MOTIVO_SEL && MOTIVO_SEL.nombre === m.nombre && MOTIVO_SEL === todos[i];
      return '<button class="mot' + (sel ? " sel" : "") + '" data-i="' + i + '" title="' + m.nombre + '"><svg viewBox="0 0 100 100">' +
        m.paths.map(function(d){ return '<path d="' + d + '" fill="#9a3412"/>'; }).join("") + "</svg></button>";
    }).join("");
  document.querySelectorAll("#gridMotivos .mot").forEach(function(b){
    b.onclick = function(){
      var i = Number(b.dataset.i);
      MOTIVO_SEL = i < 0 ? null : todos[i];
      pintarMotivos(); programarRefresco();
    };
  });
}
$("#btnIA").onclick = async function(){
  var motivo = $("#motivoTxt").value.trim();
  if (motivo.length < 3) return msgEl("iaMsg", "Describe el motivo primero.", true);
  var btn = $("#btnIA"); btn.disabled = true; msgEl("iaMsg", "🪄 Diseñando con IA… (10-20 s)");
  try {
    var r = await fetch(C.SUPABASE_URL + "/functions/v1/topper-ia", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ motivo: motivo }),
    });
    var j = await r.json();
    if (j.error) return msgEl("iaMsg", j.error, true);
    MOTIVOS_IA = j.variantes.map(function(v){ return { nombre: "IA · " + v.nombre, paths: v.paths }; });
    MOTIVO_SEL = MOTIVOS_IA[0] || null;
    pintarMotivos(); programarRefresco();
    msgEl("iaMsg", "✅ " + MOTIVOS_IA.length + " motivos generados — toca para elegir.");
  } catch (e) { msgEl("iaMsg", "Sin conexión con la IA. Intenta de nuevo.", true); }
  finally { btn.disabled = false; }
};

/* ================= Export: STL binario ================= */
function geoTriangulos(geo){
  var pos = geo.attributes.position, idx = geo.index, tris = [];
  function v(i){ return [pos.getX(i), pos.getY(i), pos.getZ(i)]; }
  if (idx) for (var i = 0; i < idx.count; i += 3) tris.push([v(idx.getX(i)), v(idx.getX(i + 1)), v(idx.getX(i + 2))]);
  else for (var j = 0; j < pos.count; j += 3) tris.push([v(j), v(j + 1), v(j + 2)]);
  return tris;
}
function stlBinario(geo){
  var tris = geoTriangulos(geo);
  var buf = new ArrayBuffer(84 + tris.length * 50);
  var dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  var off = 84;
  tris.forEach(function(t){
    var ux = t[1][0]-t[0][0], uy = t[1][1]-t[0][1], uz = t[1][2]-t[0][2];
    var vx = t[2][0]-t[0][0], vy = t[2][1]-t[0][1], vz = t[2][2]-t[0][2];
    var nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
    var l = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1;
    [nx/l, ny/l, nz/l].forEach(function(n, k){ dv.setFloat32(off + k*4, n, true); });
    off += 12;
    t.forEach(function(p){ p.forEach(function(c, k){ dv.setFloat32(off + k*4, c, true); }); off += 12; });
    dv.setUint16(off, 0, true); off += 2;
  });
  return buf;
}

/* ================= Export: 3MF multiobjeto ================= */
function geoXml(geo, id, pindex, nombre){
  var pos = geo.attributes.position, idx = geo.index;
  var verts = [], seen = {}, order = [], tri = [];
  function key(x,y,z){ return x.toFixed(3)+","+y.toFixed(3)+","+z.toFixed(3); }
  function vid(i){
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = key(x,y,z);
    if (seen[k] === undefined){ seen[k] = order.length; order.push('<vertex x="'+x.toFixed(3)+'" y="'+y.toFixed(3)+'" z="'+z.toFixed(3)+'"/>'); }
    return seen[k];
  }
  if (idx) for (var i = 0; i < idx.count; i += 3) tri.push('<triangle v1="'+vid(idx.getX(i))+'" v2="'+vid(idx.getX(i+1))+'" v3="'+vid(idx.getX(i+2))+'"/>');
  else for (var j = 0; j < pos.count; j += 3) tri.push('<triangle v1="'+vid(j)+'" v2="'+vid(j+1)+'" v3="'+vid(j+2)+'"/>');
  return '<object id="'+id+'" type="model" name="'+nombre+'" pid="1" pindex="'+pindex+'"><mesh><vertices>'+order.join("")+'</vertices><triangles>'+tri.join("")+'</triangles></mesh></object>';
}
function construir3mf(){
  var colores = [$("#c1").value, $("#c2").value, $("#c3").value];
  var partes = [], items = [], id = 2;
  [["placa","Placa",0],["texto","Texto",1],["motivo","Motivo",2]].forEach(function(p){
    if (GEOS[p[0]]){ partes.push(geoXml(GEOS[p[0]], id, p[2], p[1])); items.push('<item objectid="'+id+'"/>'); id++; }
  });
  var model = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">' +
    '<resources><m:basematerials id="1">' + colores.map(function(c,i){ return '<m:base name="Color '+(i+1)+'" displaycolor="'+c+'FF"/>'; }).join("") + '</m:basematerials>' +
    partes.join("") + '</resources><build>' + items.join("") + '</build></model>';
  var zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  zip.file("3D/3dmodel.model", model);
  return zip.generateAsync({ type: "blob", mimeType: "model/3mf" });
}
function nombreArchivo(ext){
  var base = ($("#l1").value.trim() || "topper").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").slice(0,30);
  return "topper-" + base + ext;
}
function descargar(blob, nombre){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
}
$("#btn3mf").onclick = async function(){
  refrescar();
  if (!GEOS || !GEOS.placa) return msgEl("dlMsg", "Escribe al menos una línea de texto.", true);
  msgEl("dlMsg", "Generando 3MF…");
  var blob = await construir3mf();
  descargar(blob, nombreArchivo(".3mf"));
  msgEl("dlMsg", "✅ 3MF descargado (" + GEOS.anchoMm + " mm de ancho). Ábrelo en Bambu Studio.");
};
$("#btnStl").onclick = async function(){
  refrescar();
  if (!GEOS || !GEOS.placa) return msgEl("dlMsg", "Escribe al menos una línea de texto.", true);
  msgEl("dlMsg", "Generando STLs…");
  var zip = new JSZip();
  [["placa","1-placa"],["texto","2-texto"],["motivo","3-motivo"]].forEach(function(p){
    if (GEOS[p[0]]) zip.file(p[1] + ".stl", stlBinario(GEOS[p[0]]));
  });
  var blob = await zip.generateAsync({ type: "blob" });
  descargar(blob, nombreArchivo("-stl.zip"));
  msgEl("dlMsg", "✅ ZIP con STLs por color descargado. Impórtalos juntos en Bambu Studio (como un objeto).");
};

/* ================= Arranque ================= */
(async function init(){
  tamCanvas(); loop(); pintarMotivos();
  try { await cargarFuente("greatvibes"); } catch (e) {}
  ["pacifico","poppins"].forEach(function(k){ cargarFuente(k).catch(function(){}); });
  $("#fuente").addEventListener("change", function(){ cargarFuente($("#fuente").value).then(programarRefresco); });
  MOTIVO_SEL = BIBLIOTECA[0]; pintarMotivos();
  refrescar();
})();
