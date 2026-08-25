// OiMira Toppers — texto + motivo -> placa 3D plana multicolor -> 3MF / STL (Bambu Lab)
var C = window.TP_CONFIG;
var $ = function(s){ return document.querySelector(s); };
document.getElementById("ver").textContent = C.APP_VERSION;

/* ================= Biblioteca de motivos (siempre imprimen bien) ================= */
var BIBLIOTECA = window.MOTIVOS_TRAZADOS || [];

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

// Placa-contorno: silueta engordada del texto+motivo (offset redondeado, una sola isla)
function contornoShapes(shapesMm, delta0){
  var rings = [];
  shapesMm.forEach(function(s){ var pts = s.extractPoints(12).shape; if (pts.length > 2) rings.push(pts); });
  if (!rings.length) return null;
  var subj = rings.map(function(r){ return r.map(function(p){ return { X: Math.round(p.x * CLIP_ESC), Y: Math.round(p.y * CLIP_ESC) }; }); });
  var c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  var tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  var outers = []; (tree.Childs() || []).forEach(function(n){ outers.push(n.Contour()); });
  var delta = delta0, sol = null;
  for (var t = 0; t < 8; t++){
    var co = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_ESC);
    co.AddPaths(outers, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    sol = new ClipperLib.Paths();
    co.Execute(sol, delta * CLIP_ESC);
    sol = sol.filter(function(p){ return ClipperLib.Clipper.Area(p) > 0; }); // solidos (sin agujeros: placa maciza)
    if (sol.length <= 1 || t === 7) break;
    delta += 1.6; // engordar hasta unir todo en una pieza
  }
  sol = ClipperLib.Clipper.CleanPolygons(sol, 0.15 * CLIP_ESC);
  return sol.filter(function(p){ return p.length > 2; }).map(function(p){
    return new THREE.Shape(p.map(function(q){ return new THREE.Vector2(q.X / CLIP_ESC, q.Y / CLIP_ESC); }));
  });
}
// y inferior del contorno en una x dada (para anclar palitos)
function fondoEnX(shapes, px){
  var best = null;
  shapes.forEach(function(s){
    var pts = s.extractPoints(1).shape;
    for (var i = 0; i < pts.length; i++){
      var a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a.x - px) * (b.x - px) <= 0 && a.x !== b.x){
        var y = a.y + (b.y - a.y) * (px - a.x) / (b.x - a.x);
        if (best === null || y < best) best = y;
      }
    }
  });
  return best;
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
function toClip(rings){ return rings.map(function(r){ return r.map(function(p){ return { X: Math.round(p.x * CLIP_ESC), Y: Math.round(p.y * CLIP_ESC) }; }); }); }
function treeToShapes(tree){
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
function opRings(subj, clip, tipo){
  var c = new ClipperLib.Clipper();
  c.AddPaths(toClip(subj), ClipperLib.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(toClip(clip), ClipperLib.PolyType.ptClip, true);
  var tree = new ClipperLib.PolyTree();
  c.Execute(tipo, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return treeToShapes(tree);
}
function ringsDeSvg(paths){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    paths.map(function(dd){ return '<path d="' + dd + '"/>'; }).join("") + "</svg>";
  var data = new THREE.SVGLoader().parse(svg);
  var rings = [];
  data.paths.forEach(function(p){
    p.subPaths.forEach(function(sp){ var r = sp.getPoints(24); if (r.length > 2) rings.push(r); });
  });
  return rings;
}
// motivo segun estilo: con detalles (huecos), solido, o delineado (anillo de linea)
function motivoShapes(m){
  var estiloEl = document.getElementById("estiloMot");
  var estilo = estiloEl ? estiloEl.value : "detalles";
  var base = ringsDeSvg(m.paths);
  if (!base.length) return [];
  if (estilo === "delineado"){
    var subj = toClip(base);
    var c = new ClipperLib.Clipper();
    c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
    var U = new ClipperLib.Paths();
    c.Execute(ClipperLib.ClipType.ctUnion, U, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    var co = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_ESC);
    co.AddPaths(U, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    var E = new ClipperLib.Paths();
    co.Execute(E, -5 * CLIP_ESC); // grosor de linea ~5% del motivo
    var c2 = new ClipperLib.Clipper();
    c2.AddPaths(U, ClipperLib.PolyType.ptSubject, true);
    c2.AddPaths(E, ClipperLib.PolyType.ptClip, true);
    var tree = new ClipperLib.PolyTree();
    c2.Execute(ClipperLib.ClipType.ctDifference, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    return treeToShapes(tree);
  }
  var det = (estilo === "detalles" && m.detalles && m.detalles.length) ? ringsDeSvg(m.detalles) : null;
  var out = opRings(base, det, det ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion);
  if (estilo === "solido") out.forEach(function(s){ s.holes = []; }); // silueta maciza
  return out;
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

/* ================= Vectorizador de imagenes (marching squares + suavizado) ================= */
function msRings(mask, W, H){
  var segs = new Map();
  function kOf(p){ return p[0] + "," + p[1]; }
  function add(p, q){ var k = kOf(p), a = segs.get(k); if (a) a.push(q); else segs.set(k, [q]); }
  function f(y, x){ return (x < 0 || y < 0 || x >= W || y >= H) ? 0 : mask[y * W + x]; }
  for (var y = -1; y < H; y++){
    for (var x = -1; x < W; x++){
      var a = f(y, x), b = f(y, x + 1), c = f(y + 1, x + 1), dd = f(y + 1, x);
      var idx = a * 8 + b * 4 + c * 2 + dd;
      if (idx === 0 || idx === 15) continue;
      var T = [2 * x + 1, 2 * y], R = [2 * x + 2, 2 * y + 1], B = [2 * x + 1, 2 * y + 2], L = [2 * x, 2 * y + 1];
      var ee;
      if (idx === 1) ee = [[B, L]]; else if (idx === 2) ee = [[R, B]]; else if (idx === 3) ee = [[R, L]];
      else if (idx === 4) ee = [[T, R]]; else if (idx === 5) ee = [[T, R], [B, L]]; else if (idx === 6) ee = [[T, B]];
      else if (idx === 7) ee = [[T, L]]; else if (idx === 8) ee = [[L, T]]; else if (idx === 9) ee = [[B, T]];
      else if (idx === 10) ee = [[L, T], [R, B]]; else if (idx === 11) ee = [[R, T]]; else if (idx === 12) ee = [[L, R]];
      else if (idx === 13) ee = [[B, R]]; else ee = [[L, B]];
      ee.forEach(function(s){ add(s[0], s[1]); });
    }
  }
  var rings = [];
  while (segs.size){
    var startK = segs.keys().next().value;
    var start = startK.split(",").map(Number);
    var ring = [start], cur = startK;
    while (true){
      var lst = segs.get(cur);
      if (!lst || !lst.length){ segs.delete(cur); break; }
      var nxt = lst.pop();
      if (!lst.length) segs.delete(cur);
      ring.push(nxt);
      cur = kOf(nxt);
      if (cur === startK) break;
    }
    if (ring.length > 8) rings.push(ring);
  }
  return rings;
}
function rdpJS(pts, eps){
  if (pts.length < 3) return pts;
  var stack = [[0, pts.length - 1]], keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  while (stack.length){
    var seg = stack.pop(), i0 = seg[0], i1 = seg[1];
    var ax = pts[i0][0], ay = pts[i0][1], bx = pts[i1][0], by = pts[i1][1];
    var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
    var dmax = 0, im = -1;
    for (var i = i0 + 1; i < i1; i++){
      var dd = L < 1e-9
        ? Math.sqrt((pts[i][0] - ax) * (pts[i][0] - ax) + (pts[i][1] - ay) * (pts[i][1] - ay))
        : Math.abs(dx * (ay - pts[i][1]) - dy * (ax - pts[i][0])) / L;
      if (dd > dmax){ dmax = dd; im = i; }
    }
    if (dmax > eps && im > 0){ keep[im] = 1; stack.push([i0, im], [im, i1]); }
  }
  var out = [];
  for (var j = 0; j < pts.length; j++) if (keep[j]) out.push(pts[j]);
  return out;
}
function chaikinJS(pts, n){
  for (var t = 0; t < n; t++){
    var out = [], m = pts.length;
    for (var i = 0; i < m; i++){
      var p = pts[i], q = pts[(i + 1) % m];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
      out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    pts = out;
  }
  return pts;
}
// imagen (Image/canvas) -> paths SVG en viewBox 100 (silueta oscura sobre fondo claro)
function trazarImagen(img){
  var N = 420, cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  var ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, N, N);
  ctx.drawImage(img, 0, 0, N, N);
  var px = ctx.getImageData(0, 0, N, N).data;
  var mask = new Uint8Array(N * N);
  for (var i = 0; i < N * N; i++){
    var lum = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    mask[i] = lum < 128 ? 1 : 0;
  }
  var rings = msRings(mask, N, N).filter(function(r){
    var a = 0;
    for (var i2 = 0; i2 < r.length; i2++){ var p = r[i2], q = r[(i2 + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(a / 2) > 160; // quitar ruido
  });
  if (!rings.length) return [];
  var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  rings.forEach(function(r){ r.forEach(function(p){ if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
  var w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
  var s = 92 / Math.max(w, h), ox = (100 - w * s) / 2 - x0 * s, oy = (100 - h * s) / 2 - y0 * s;
  var dpaths = [];
  rings.forEach(function(r){
    var r2 = rdpJS(r, 2.0);
    if (r2.length < 4) return;
    if (r2[0][0] === r2[r2.length - 1][0] && r2[0][1] === r2[r2.length - 1][1]) r2 = r2.slice(0, -1);
    var r3 = chaikinJS(r2, 2);
    dpaths.push("M" + r3.map(function(p){ return (Math.round((p[0] * s + ox) * 10) / 10) + " " + (Math.round((p[1] * s + oy) * 10) / 10); }).join(" L ") + " Z");
  });
  return dpaths;
}

/* ================= Adornos caligraficos (remates bajo el texto) ================= */
var ADORNOS_BASE = [
  { nombre:"Flecha", grosor:3, trazos:[
    "M8 50 L92 50", "M78 40 L92 50 L78 60", "M20 40 L10 50 L20 60", "M28 42 L20 50 L28 58"
  ]},
  { nombre:"Laurel", grosor:2.6, trazos:["M8 62 C30 44 70 44 92 62"],
    paths:["M15 50 L20 46 L25 50 L20 54 Z","M27 45 L32 41 L37 45 L32 49 Z","M39 42 L44 38 L49 42 L44 46 Z","M51 42 L56 38 L61 42 L56 46 Z","M63 45 L68 41 L73 45 L68 49 Z","M75 50 L80 46 L85 50 L80 54 Z"] },
  { nombre:"Puntos y rombo", grosor:2.4, trazos:["M14 50 L86 50"],
    paths:["M42 50 L50 43 L58 50 L50 57 Z","M17 50 C17 48.3 18.3 47 20 47 C21.7 47 23 48.3 23 50 C23 51.7 21.7 53 20 53 C18.3 53 17 51.7 17 50 Z","M77 50 C77 48.3 78.3 47 80 47 C81.7 47 83 48.3 83 50 C83 51.7 81.7 53 80 53 C78.3 53 77 51.7 77 50 Z"] }
];
var ADORNOS_LISTA = (window.ADORNOS_TRAZADOS || []).concat(ADORNOS_BASE);
var ADORNO_SEL = null;

// trazo abierto -> banda rellena (Clipper offset redondo sobre linea abierta)
function trazosRings(paths, w){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    paths.map(function(dd){ return '<path d="' + dd + '"/>'; }).join("") + "</svg>";
  var data = new THREE.SVGLoader().parse(svg);
  var polys = [];
  data.paths.forEach(function(p){
    p.subPaths.forEach(function(sp){ var r = sp.getPoints(28); if (r.length > 1) polys.push(r); });
  });
  var co = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_ESC);
  co.AddPaths(toClip(polys), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  var sol = new ClipperLib.Paths();
  co.Execute(sol, (w / 2) * CLIP_ESC);
  return sol.map(function(p){ return p.map(function(q){ return new THREE.Vector2(q.X / CLIP_ESC, q.Y / CLIP_ESC); }); });
}
function adornoShapes(a){
  var rings = (a.paths && a.paths.length) ? ringsDeSvg(a.paths) : [];
  if (a.trazos && a.trazos.length) rings = rings.concat(trazosRings(a.trazos, a.grosor || 4));
  return unionRings(rings);
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

  // --- motivo (arriba o abajo, tamaño ajustable) ---
  var motShapes = [];
  var topStack = tb.max.y, botStack = tb.min.y; // pilas para apilar motivo/adorno
  if (MOTIVO_SEL){
    var raw = motivoShapes(MOTIVO_SEL);
    var mb = shapesBBox(raw);
    var mw = Math.max(mb.max.x - mb.min.x, 1), mh = Math.max(mb.max.y - mb.min.y, 1);
    var pctM = Math.max(30, Math.min(300, Number(($("#motTam") || {}).value) || 100)) / 100;
    var target = Math.max(maxW * 0.45, SIZE * 1.2) * pctM;
    var k = target / mw;
    var mcx = (mb.min.x + mb.max.x) / 2;
    var motArriba = !document.getElementById("motPos") || $("#motPos").value !== "abajo";
    var gapM = SIZE * 0.45, cyM;
    if (motArriba){ cyM = topStack + mh * k * 0.5 + gapM; topStack += mh * k + gapM; }
    else { cyM = botStack - mh * k * 0.5 - gapM; botStack -= mh * k + gapM; }
    raw.forEach(function(s){
      motShapes.push(bakeShape(s,
        function(x){ return (x - mcx) * k; },
        function(y){ return (y - (mb.min.y + mb.max.y) / 2) * -k + cyM; } // flip svg
      ));
    });
  }

  // --- adorno caligrafico debajo del texto ---
  var adShapes = [];
  var adSel = ADORNO_SEL;
  if (adSel && textShapes.length){
    var rawA = adornoShapes(adSel);
    if (rawA.length){
      var abb = shapesBBox(rawA);
      var aw2 = Math.max(abb.max.x - abb.min.x, 1), ah2 = Math.max(abb.max.y - abb.min.y, 1);
      var pctA = Math.max(30, Math.min(300, Number(($("#adTam") || {}).value) || 100)) / 100;
      var ka = Math.max(maxW * 0.38, SIZE * 1.1) / aw2;
      if (ah2 * ka > SIZE * 1.05) ka = SIZE * 1.05 / ah2; // que no domine el diseño
      ka *= pctA;
      var acx2 = (abb.min.x + abb.max.x) / 2;
      var adAbajo = !document.getElementById("adPos") || $("#adPos").value !== "arriba";
      var gapA = SIZE * 0.18, cyA;
      if (adAbajo){ cyA = botStack - ah2 * ka * 0.5 - gapA; botStack -= ah2 * ka + gapA; }
      else { cyA = topStack + ah2 * ka * 0.5 + gapA; topStack += ah2 * ka + gapA; }
      rawA.forEach(function(s){
        adShapes.push(bakeShape(s,
          function(x){ return (x - acx2) * ka; },
          function(y){ return (y - (abb.min.y + abb.max.y) / 2) * -ka + cyA; }
        ));
      });
    }
  }

  // --- bbox contenido total ---
  var all = textShapes.concat(motShapes).concat(adShapes);
  var cb = shapesBBox(all);
  var cw = cb.max.x - cb.min.x, ch = cb.max.y - cb.min.y;
  var ccx = (cb.min.x + cb.max.x) / 2, ccy = (cb.min.y + cb.max.y) / 2;

  // --- escala global para que la placa mida anchoMm ---
  var padX = cw * 0.14 + SIZE * 0.25, padY = ch * 0.14 + SIZE * 0.25;
  var plateW = cw + padX * 2, plateH = ch + padY * 2;
  var forma = $("#placa").value;
  var esc = anchoMm / plateW;
  if (forma === "contorno"){
    var mg0 = Math.max(3, anchoMm * 0.032);
    esc = (anchoMm - 2 * mg0) / cw; // el contorno agrega el margen: asi el ancho final = pedido
  } else if (forma === "letras"){
    esc = anchoMm / cw;
  } else if (forma === "aro"){
    esc = Math.min(anchoMm * 0.82 / cw, anchoMm * 0.72 / Math.max(ch, 1));
  }
  function T(shapes){
    return shapes.map(function(s){
      return bakeShape(s, function(x){ return (x - ccx) * esc; }, function(y){ return (y - ccy) * esc; }); // ya esta en y-arriba
    });
  }
  var textMm = T(textShapes), motMm = T(motShapes), adMm = T(adShapes);
  var plateWmm = plateW * esc, plateHmm = plateH * esc;

  // barras conectoras (estilo acrilico / aro)
  var lineInfo = lineas.map(function(t, i){
    return { base: (-i * LH - ccy) * esc, hw: medidas[i] / 2 * esc };
  });
  function barra(x1, y1, x2, y2){
    var s = new THREE.Shape();
    s.moveTo(x1, y1); s.lineTo(x2, y1); s.lineTo(x2, y2); s.lineTo(x1, y2); s.closePath();
    return s;
  }
  function palito(px, topY, pl){
    var pw2 = 6, st = new THREE.Shape();
    st.moveTo(px - pw2 / 2, topY); st.lineTo(px + pw2 / 2, topY);
    st.lineTo(px + pw2 / 2, topY - pl + 4); st.lineTo(px, topY - pl);
    st.lineTo(px - pw2 / 2, topY - pl + 4); st.closePath();
    return st;
  }
  function barrasConectoras(){
    var bars = [];
    lineInfo.forEach(function(li){ bars.push(barra(-li.hw * 0.86, li.base + 0.5, li.hw * 0.86, li.base + 3.4)); }); // escondida tras el cuerpo de las letras
    for (var i = 0; i + 1 < lineInfo.length; i++){
      var hw2 = Math.min(lineInfo[i].hw, lineInfo[i + 1].hw) * 0.55;
      [-hw2, hw2].forEach(function(px){ bars.push(barra(px - 1.3, lineInfo[i + 1].base, px + 1.3, lineInfo[i].base)); });
    }
    var tTop = (tb.max.y - ccy) * esc, tBot = (tb.min.y - ccy) * esc;
    [motMm, adMm].forEach(function(arr){
      if (!arr.length || !textMm.length) return;
      var eb = shapesBBox(arr), ec = (eb.min.y + eb.max.y) / 2;
      if (ec > tTop) bars.push(barra(-1.2, tTop - 2, 1.2, ec));
      else bars.push(barra(-1.2, ec, 1.2, tBot + 2));
    });
    return bars;
  }

  // --- placa ---
  var plateShapes;
  if (forma === "contorno"){
    var margen = Math.max(3, anchoMm * 0.032);
    plateShapes = contornoShapes(textMm.concat(motMm).concat(adMm), margen) || [];
    if (!plateShapes.length) forma = "ovalo";
    else {
      var cbb = shapesBBox(plateShapes);
      plateWmm = cbb.max.x - cbb.min.x; plateHmm = cbb.max.y - cbb.min.y;
      if ($("#palitos").checked){
        var plc = Number($("#palLen").value) || 45, pwc = 6;
        var xs = [];
        plateShapes.forEach(function(s){ s.extractPoints(1).shape.forEach(function(p){ if (p.y < cbb.min.y + 9) xs.push(p.x); }); });
        var xlo = Math.min.apply(null, xs), xhi = Math.max.apply(null, xs);
        var posiciones = (xhi - xlo) < 26 ? [(xlo + xhi) / 2] : [xlo + (xhi - xlo) * 0.25, xlo + (xhi - xlo) * 0.75];
        posiciones.forEach(function(px){
          var fy = fondoEnX(plateShapes, px); if (fy === null) fy = cbb.min.y + 6;
          var st = new THREE.Shape();
          st.moveTo(px - pwc / 2, fy + 7); st.lineTo(px + pwc / 2, fy + 7);
          st.lineTo(px + pwc / 2, fy - plc + 4); st.lineTo(px, fy - plc);
          st.lineTo(px - pwc / 2, fy - plc + 4); st.closePath();
          plateShapes.push(st);
        });
      }
    }
  }
  if (forma === "letras"){
    // estilo acrilico: todo el diseño fusionado, sin placa de fondo
    var rings2 = [];
    textMm.concat(motMm).concat(adMm).forEach(function(s){ var p = s.extractPoints(10).shape; if (p.length > 2) rings2.push(p); });
    barrasConectoras().forEach(function(s){ rings2.push(s.extractPoints(1).shape); });
    if ($("#palitos").checked && lineInfo.length){
      var plL = Number($("#palLen").value) || 45;
      var last = lineInfo[lineInfo.length - 1];
      var topP = last.base + 1;
      [motMm, adMm].forEach(function(arr){
        if (arr.length){ var eb2 = shapesBBox(arr); if (eb2.min.y < topP - 3) topP = eb2.min.y + 2; }
      });
      var pxs = last.hw > 16 ? [-last.hw * 0.5, last.hw * 0.5] : [0];
      pxs.forEach(function(px){ rings2.push(palito(px, topP, plL).extractPoints(1).shape); });
    }
    var c3 = new ClipperLib.Clipper();
    c3.AddPaths(toClip(rings2), ClipperLib.PolyType.ptSubject, true);
    var U2 = new ClipperLib.Paths();
    c3.Execute(ClipperLib.ClipType.ctUnion, U2, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    var co2 = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_ESC);
    co2.AddPaths(U2, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    var sol2 = new ClipperLib.Paths();
    co2.Execute(sol2, 1.2 * CLIP_ESC); // borde de 1.2mm alrededor de las letras
    sol2 = ClipperLib.Clipper.CleanPolygons(sol2.filter(function(p){ return ClipperLib.Clipper.Area(p) > 0 && p.length > 2; }), 0.1 * CLIP_ESC);
    plateShapes = sol2.map(function(p){
      return new THREE.Shape(p.map(function(q){ return new THREE.Vector2(q.X / CLIP_ESC, q.Y / CLIP_ESC); }));
    });
    var bb4 = shapesBBox(plateShapes);
    plateWmm = bb4.max.x - bb4.min.x; plateHmm = bb4.max.y - bb4.min.y;
  }
  else if (forma === "aro"){
    var R = anchoMm / 2, ringW = Math.max(3.2, anchoMm * 0.028);
    var ringS = new THREE.Shape();
    ringS.absellipse(0, 0, R, R, 0, Math.PI * 2, false, 0);
    var holeA = new THREE.Path();
    holeA.absellipse(0, 0, R - ringW, R - ringW, 0, Math.PI * 2, true, 0);
    ringS.holes.push(holeA);
    plateShapes = [ringS];
    lineInfo.forEach(function(li){
      var half = Math.sqrt(Math.max(0, (R - 1) * (R - 1) - li.base * li.base));
      plateShapes.push(barra(-half, li.base + 0.5, half, li.base + 3.4));
    });
    barrasConectoras().forEach(function(b){ plateShapes.push(b); });
    if ($("#palitos").checked){
      var plA = Number($("#palLen").value) || 45;
      [-R * 0.35, R * 0.35].forEach(function(px){
        var top = -Math.sqrt(Math.max(0, R * R - px * px)) + 7;
        plateShapes.push(palito(px, top, plA));
      });
    }
    plateWmm = 2 * R; plateHmm = 2 * R;
  }
  else if (forma === "ovalo" || forma === "rect"){
  var plate = new THREE.Shape();
  if (forma === "ovalo"){
    plate.absellipse(0, 0, plateWmm / 2, plateHmm / 2 * 1.06, 0, Math.PI * 2, false, 0);
  } else {
    var r = Math.min(10, plateHmm * 0.2), hw = plateWmm / 2, hh = plateHmm / 2;
    plate.moveTo(-hw + r, -hh);
    plate.lineTo(hw - r, -hh); plate.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
    plate.lineTo(hw, hh - r); plate.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
    plate.lineTo(-hw + r, hh); plate.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
    plate.lineTo(-hw, -hh + r); plate.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  }
  plateShapes = [plate];
  // palitos
  if ($("#palitos").checked){
    var pl = Number($("#palLen").value) || 45, pw = 6;
    var yBottom = -plateHmm / 2 * (forma === "ovalo" ? 0.75 : 0.98);
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
  }

  // --- extrusiones ---
  function extr(shapes, depth){
    if (!shapes.length) return null;
    var g = new THREE.ExtrudeGeometry(shapes, { depth: depth, bevelEnabled: false, curveSegments: 18 });
    return g;
  }
  var fullDepth = (forma === "aro" || forma === "letras");
  var dRel = fullDepth ? grosor + relieve : relieve;
  var gPlaca = extr(plateShapes, grosor);
  var gTexto = extr(textMm, dRel); if (gTexto && !fullDepth) gTexto.translate(0, 0, grosor);
  var gMot = extr(motMm, dRel); if (gMot && !fullDepth) gMot.translate(0, 0, grosor);
  var gAd = extr(adMm, dRel); if (gAd && !fullDepth) gAd.translate(0, 0, grosor);
  // --- borde de color siguiendo la silueta de la placa ---
  var gBorde = null;
  var bordeChk = document.getElementById("bordeOn");
  if (bordeChk && bordeChk.checked && plateShapes.length){
    var bw = Math.max(1.8, anchoMm * 0.016);
    var ringsP = [];
    plateShapes.forEach(function(s){
      var pts = s.extractPoints(24);
      if (pts.shape.length > 2) ringsP.push(pts.shape);
      (pts.holes || []).forEach(function(hh){ if (hh.length > 2) ringsP.push(hh); });
    });
    var cB = new ClipperLib.Clipper();
    cB.AddPaths(toClip(ringsP), ClipperLib.PolyType.ptSubject, true);
    var UB = new ClipperLib.Paths();
    cB.Execute(ClipperLib.ClipType.ctUnion, UB, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    var coB = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_ESC);
    coB.AddPaths(UB, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    var EB = new ClipperLib.Paths();
    coB.Execute(EB, -bw * CLIP_ESC);
    var cB2 = new ClipperLib.Clipper();
    cB2.AddPaths(UB, ClipperLib.PolyType.ptSubject, true);
    cB2.AddPaths(EB, ClipperLib.PolyType.ptClip, true);
    var treeB = new ClipperLib.PolyTree();
    cB2.Execute(ClipperLib.ClipType.ctDifference, treeB, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    var bordeShapes = treeToShapes(treeB);
    gBorde = extr(bordeShapes, relieve);
    if (gBorde) gBorde.translate(0, 0, grosor);
  }
  return { placa: gPlaca, texto: gTexto, motivo: gMot, adorno: gAd, borde: gBorde, anchoMm: anchoMm, altoMm: plateHmm };
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
  add(b.adorno, $("#c4").value);
  add(b.borde, $("#c5").value);
}
function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene, cam); }

function programarRefresco(){ clearTimeout(renderTimer); renderTimer = setTimeout(refrescar, 350); }
["l1","l2","l3","fuente","placa","estiloMot","motPos","motTam","adPos","adTam","ancho","grosor","relieve","palitos","palLen","c1","c2","c3","c4","c5","bordeOn"].forEach(function(id){
  var el = document.getElementById(id);
  el.addEventListener("input", programarRefresco);
  el.addEventListener("change", programarRefresco);
});

/* ================= Motivos: biblioteca + IA ================= */
function pintarAdornos(){
  var g = document.getElementById("gridAdornos");
  if (!g) return;
  g.innerHTML = '<button class="mot' + (ADORNO_SEL === null ? " sel" : "") + '" data-i="-1" title="Sin adorno"><svg viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="80" stroke="#ccc" stroke-width="6"/><line x1="80" y1="20" x2="20" y2="80" stroke="#ccc" stroke-width="6"/></svg><span>Ninguno</span></button>' +
    ADORNOS_LISTA.map(function(a, i){
      var sel = ADORNO_SEL === ADORNOS_LISTA[i];
      var svg = (a.paths || []).map(function(dd){ return '<path d="' + dd + '" fill="#9a3412"/>'; }).join("") +
        (a.trazos || []).map(function(dd){ return '<path d="' + dd + '" fill="none" stroke="#9a3412" stroke-width="' + (a.grosor || 3) + '" stroke-linecap="round"/>'; }).join("");
      return '<button class="mot' + (sel ? " sel" : "") + '" data-i="' + i + '" title="' + a.nombre + '"><svg viewBox="0 0 100 100">' + svg + '</svg><span>' + a.nombre + '</span></button>';
    }).join("");
  g.querySelectorAll(".mot").forEach(function(b){
    b.onclick = function(){
      var i = Number(b.dataset.i);
      ADORNO_SEL = i < 0 ? null : ADORNOS_LISTA[i];
      pintarAdornos(); programarRefresco();
    };
  });
}
function pintarMotivos(){
  var todos = MOTIVOS_IA.concat(BIBLIOTECA);
  $("#gridMotivos").innerHTML = '<button class="mot' + (MOTIVO_SEL === null ? " sel" : "") + '" data-i="-1" title="Sin motivo"><svg viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="80" stroke="#ccc" stroke-width="6"/><line x1="80" y1="20" x2="20" y2="80" stroke="#ccc" stroke-width="6"/></svg><span>Ninguno</span></button>' +
    todos.map(function(m, i){
      var sel = MOTIVO_SEL === todos[i];
      return '<button class="mot' + (sel ? " sel" : "") + '" data-i="' + i + '" title="' + (m.tema ? m.tema + " · " : "") + m.nombre + '"><svg viewBox="0 0 100 100">' +
        m.paths.map(function(dd){ return '<path d="' + dd + '" fill="#9a3412"/>'; }).join("") +
        (m.detalles || []).map(function(dd){ return '<path d="' + dd + '" fill="#fff"/>'; }).join("") + '</svg><span>' + m.nombre + '</span></button>';
    }).join("");
  document.querySelectorAll("#gridMotivos .mot").forEach(function(b){
    b.onclick = function(){
      var i = Number(b.dataset.i);
      MOTIVO_SEL = i < 0 ? null : MOTIVOS_IA.concat(BIBLIOTECA)[i];
      pintarMotivos(); programarRefresco();
    };
  });
}

$("#btnIA").onclick = async function(){
  var motivo = $("#motivoTxt").value.trim();
  if (motivo.length < 3) return msgEl("iaMsg", "Describe el motivo primero.", true);
  var btn = $("#btnIA"); btn.disabled = true;
  try {
    // 1) intento premium: imagen Flux -> vectorizado en el navegador
    msgEl("iaMsg", "🪄 Generando con IA de imágenes… (15-30 s)");
    var r1 = await fetch(C.SUPABASE_URL + "/functions/v1/topper-imagen", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ motivo: motivo }),
    });
    var j1 = await r1.json().catch(function(){ return {}; });
    if (j1.imagenes && j1.imagenes.length){
      var nuevos = [];
      for (var i = 0; i < j1.imagenes.length; i++){
        var img = new Image();
        await new Promise(function(res, rej){ img.onload = res; img.onerror = rej; img.src = "data:image/jpeg;base64," + j1.imagenes[i]; });
        var paths = trazarImagen(img);
        if (paths.length) nuevos.push({ nombre: "IA · " + motivo.slice(0, 18) + " " + (i + 1), paths: paths });
      }
      if (nuevos.length){
        MOTIVOS_IA = nuevos; MOTIVO_SEL = nuevos[0];
        pintarMotivos(); programarRefresco();
        return msgEl("iaMsg", "✅ " + nuevos.length + " motivos profesionales generados — toca para elegir.");
      }
    }
    // 2) fallback: Claude dibuja los paths
    msgEl("iaMsg", "🪄 Diseñando con IA… (10-20 s)");
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
  var colores = [$("#c1").value, $("#c2").value, $("#c3").value, $("#c4").value, $("#c5").value];
  var partes = [], items = [], objInfo = [], id = 2;
  [["placa","Placa",0],["texto","Texto",1],["motivo","Motivo",2],["adorno","Adorno",3],["borde","Borde",4]].forEach(function(p){
    if (GEOS[p[0]]){ partes.push(geoXml(GEOS[p[0]], id, p[2], p[1])); items.push('<item objectid="'+id+'"/>'); objInfo.push({ id: id, nombre: p[1], ext: p[2] + 1 }); id++; }
  });
  var model = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">' +
    '<resources><m:basematerials id="1">' + colores.map(function(c,i){ return '<m:base name="Color '+(i+1)+'" displaycolor="'+c+'FF"/>'; }).join("") + '</m:basematerials>' +
    partes.join("") + '</resources><build>' + items.join("") + '</build></model>';
  var zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  zip.file("3D/3dmodel.model", model);
  // Bambu Studio: asignacion de extruder (filamento) por objeto
  zip.file("Metadata/model_settings.config", '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n' +
    objInfo.map(function(o){ return '  <object id="' + o.id + '">\n    <metadata key="name" value="' + o.nombre + '"/>\n    <metadata key="extruder" value="' + o.ext + '"/>\n  </object>\n'; }).join("") + '</config>');
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
  [["placa","1-placa"],["texto","2-texto"],["motivo","3-motivo"],["adorno","4-adorno"],["borde","5-borde"]].forEach(function(p){
    if (GEOS[p[0]]) zip.file(p[1] + ".stl", stlBinario(GEOS[p[0]]));
  });
  var blob = await zip.generateAsync({ type: "blob" });
  descargar(blob, nombreArchivo("-stl.zip"));
  msgEl("dlMsg", "✅ ZIP con STLs por color descargado. Impórtalos juntos en Bambu Studio (como un objeto).");
};

/* ================= Aviso al salir + enviar por correo ================= */
window.addEventListener("beforeunload", function(e){
  var hay = ["l1","l2","l3"].some(function(id){ var el = document.getElementById(id); return el && el.value.trim(); });
  if (hay){ e.preventDefault(); e.returnValue = "Se perdera el diseno actual."; return e.returnValue; }
});
document.getElementById("btnMail").onclick = async function(){
  refrescar();
  if (!GEOS || !GEOS.placa) return msgEl("dlMsg", "Escribe al menos una linea de texto.", true);
  var btn = document.getElementById("btnMail"); btn.disabled = true;
  msgEl("dlMsg", "Generando y enviando a tu correo…");
  try {
    var blob = await construir3mf();
    var b64 = await new Promise(function(res, rej){
      var fr = new FileReader();
      fr.onload = function(){ res(String(fr.result).split(",")[1]); };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    var r = await fetch(C.SUPABASE_URL + "/functions/v1/topper-correo", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ nombre: nombreArchivo(".3mf"), archivo: b64 }),
    });
    var j = await r.json().catch(function(){ return {}; });
    if (j.ok) msgEl("dlMsg", "✅ Enviado a " + (j.para || "tu correo") + ".");
    else msgEl("dlMsg", j.error || "No se pudo enviar. Intenta de nuevo.", true);
  } catch (e) { msgEl("dlMsg", "No se pudo enviar. Revisa tu conexion.", true); }
  finally { btn.disabled = false; }
};

/* ================= Arranque ================= */
(async function init(){
  tamCanvas(); loop(); pintarMotivos(); pintarAdornos();
  try { await cargarFuente("greatvibes"); } catch (e) {}
  ["pacifico","poppins"].forEach(function(k){ cargarFuente(k).catch(function(){}); });
  $("#fuente").addEventListener("change", function(){ cargarFuente($("#fuente").value).then(programarRefresco); });
  MOTIVO_SEL = BIBLIOTECA[0]; pintarMotivos();
  refrescar();
})();
