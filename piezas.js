/* OiMira Toppers - piezas de impresion: aplica la regla de profundidad de color a los solidos del topper.
   Regla: mirando de frente, cada punto tiene un color visible; ese color ocupa el milimetro (profColor) de arriba
   de ese punto y todo lo que queda debajo se imprime del color de la placa. La forma y las alturas no cambian.

   Solido = { rol, nombre, color, shapes: THREE.Shape[], z0, z1, prioridad }   (z en mm; solidos[0] es la placa)
   Pieza  = { rol, nombre, color, prismas: [{ shapes: THREE.Shape[], z0, z1 }], extra: THREE.BufferGeometry|null } */
var PZ_ESC = 100;        // rejilla de 0,01 mm (la misma de Clipper en app.js)
var PZ_AREA_MIN = 0.01;  // mm2: se descartan astillas mas chicas

function pzPaths(shapes){ // THREE.Shape[] -> Paths de Clipper (cada shape par-impar con sus huecos; union entre shapes)
  var c = new ClipperLib.Clipper(), n = 0;
  (shapes || []).forEach(function(s){
    var p = s.extractPoints(48); if (p.shape.length < 3) return;
    var anillos = [p.shape].concat((p.holes || []).filter(function(h){ return h.length > 2; })).map(function(r){
      return r.map(function(q){ return { X: Math.round(q.x * PZ_ESC), Y: Math.round(q.y * PZ_ESC) }; });
    });
    var cc = new ClipperLib.Clipper(), u = new ClipperLib.Paths();
    cc.AddPaths(anillos, ClipperLib.PolyType.ptSubject, true);
    cc.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    if (u.length){ c.AddPaths(u, ClipperLib.PolyType.ptSubject, true); n++; }
  });
  var U = new ClipperLib.Paths();
  if (n) c.Execute(ClipperLib.ClipType.ctUnion, U, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return U;
}
function pzOp(a, b, tipo){ // operacion booleana entre dos conjuntos ya normalizados
  if (!a.length) return tipo === ClipperLib.ClipType.ctUnion ? b : [];
  if (!b.length) return tipo === ClipperLib.ClipType.ctIntersection ? [] : a;
  var c = new ClipperLib.Clipper(), sol = new ClipperLib.Paths();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true); c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
// Quita los vertices que estan en linea recta con sus vecinos (la triangulacion de las tapas los ignora y las
// paredes no: sin esto quedan uniones en T entre tapa y pared) y las agujas (puntas de menos de 0,02 mm de base,
// ruido de la rejilla: la triangulacion las descarta y dejarian un agujero microscopico en la tapa).
function pzSinColineales(r){
  var cambio = true;
  while (cambio && r.length > 3){
    cambio = false;
    for (var i = 0; i < r.length && r.length > 3; i++){
      var a = r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length];
      var recto = (b.X - a.X) * (c.Y - b.Y) - (b.Y - a.Y) * (c.X - b.X) === 0;
      var ux = a.X - b.X, uy = a.Y - b.Y, vx = c.X - b.X, vy = c.Y - b.Y, cruz = Math.abs(ux * vy - uy * vx);
      // aguja: punta con base de 0,02 mm o menos, o que se dobla sobre si misma (menos de 3 grados) con area infima
      var aguja = (c.X - a.X) * (c.X - a.X) + (c.Y - a.Y) * (c.Y - a.Y) <= 4 ||
        (cruz < 200 && ux * vx + uy * vy > 0 && cruz < 0.05 * Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy)));
      if (recto || aguja){ r.splice(i, 1); i--; cambio = true; }
    }
  }
  return r;
}
// Astilla: contorno de area minima o mas fino que 0,03 mm (ruido de la rejilla al restar regiones); no se imprime.
function pzAstilla(r, areaMin){
  var area = Math.abs(ClipperLib.Clipper.Area(r)), per = 0;
  for (var i = 0; i < r.length; i++){ var a = r[i], b = r[(i + 1) % r.length]; per += Math.sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y)); }
  return area < areaMin || area / per < 0.015 * PZ_ESC;
}
function pzShapes(paths){ // Paths -> THREE.Shape[] con huecos; descarta astillas
  if (!paths.length) return [];
  var c = new ClipperLib.Clipper(), tree = new ClipperLib.PolyTree(), out = [], min = PZ_AREA_MIN * PZ_ESC * PZ_ESC;
  c.StrictlySimple = true; // sin vertices que se tocan: cada contorno da una malla cerrada
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  function v2(p){ return new THREE.Vector2(p.X / PZ_ESC, p.Y / PZ_ESC); }
  function baja(nodo){
    (nodo.Childs() || []).forEach(function(ext){
      var cont = pzSinColineales(ext.Contour().slice());
      if (cont.length > 2 && !pzAstilla(cont, min)){
        var s = new THREE.Shape(cont.map(v2));
        (ext.Childs() || []).forEach(function(h){
          var hc = pzSinColineales(h.Contour().slice());
          if (hc.length > 2 && !pzAstilla(hc, min)) s.holes.push(new THREE.Path(hc.map(v2)));
        });
        out.push(s);
      }
      (ext.Childs() || []).forEach(function(h){ baja(h); }); // islas dentro de un hueco
    });
  }
  baja(tree);
  return out;
}

// Limpia un area: la encoge 0,02 mm y la vuelve a crecer. Borra agujas, astillas y cuellos mas finos que 0,04 mm
// (ruido de la rejilla al restar regiones, que no se imprime y rompe la triangulacion) y separa contornos que se tocan.
function pzLimpia(paths){
  if (!paths.length) return paths;
  function despl(p, d){
    var co = new ClipperLib.ClipperOffset(4, 0.25 * PZ_ESC), sol = new ClipperLib.Paths();
    co.AddPaths(p, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    co.Execute(sol, d);
    return sol;
  }
  var e = despl(paths, -2);
  return e.length ? despl(e, 2) : e;
}

// Solidos -> piezas de impresion. La primera pieza es siempre la placa (todo lo que va del color de la placa).
function piezasDeImpresion(solidos, profColor){
  var P = Math.max(1, Number(profColor) || 1), EPS = 1e-6, CT = ClipperLib.ClipType;
  var S = solidos.map(function(s){ return { s: s, paths: pzPaths(s.shapes), vis: null }; }).filter(function(o, i){ return i === 0 || o.paths.length; });
  // 1) region visible de cada solido: su silueta menos lo que tiene encima (mas alto; a igual altura, mas prioridad)
  var orden = S.slice().sort(function(a, b){ return (b.s.z1 - a.s.z1) || (b.s.prioridad - a.s.prioridad); });
  var encima = [];
  orden.forEach(function(o){ o.vis = pzOp(o.paths, encima, CT.ctDifference); encima = pzOp(encima, o.paths, CT.ctUnion); });
  // 2) cortes en z (la placa no necesita corte de color: ya es de su color)
  var cortes = [];
  S.forEach(function(o, i){ cortes.push(o.s.z0, o.s.z1); if (i > 0) cortes.push(Math.max(0, o.s.z1 - P)); });
  cortes = cortes.sort(function(a, b){ return a - b; }).filter(function(z, i, arr){ return i === 0 || z - arr[i - 1] > EPS; });
  // 3) por tramo: material, areas de color y resto (color de la placa)
  var piezas = S.map(function(o){ return { rol: o.s.rol, nombre: o.s.nombre, color: o.s.color, prismas: [], extra: null, _ult: null }; });
  function agregar(pz, paths, za, zb){
    paths = pzLimpia(paths);
    if (!paths.length) return;
    var firma = JSON.stringify(paths), u = pz._ult;
    if (u && u.firma === firma && Math.abs(u.pr.z1 - za) < EPS){ u.pr.z1 = zb; return; } // misma area justo debajo: un solo prisma
    var shapes = pzShapes(paths); if (!shapes.length) return;
    var pr = { shapes: shapes, z0: za, z1: zb }; pz.prismas.push(pr); pz._ult = { firma: firma, pr: pr };
  }
  for (var k = 0; k + 1 < cortes.length; k++){
    var za = cortes[k], zb = cortes[k + 1], material = [], resto;
    S.forEach(function(o){ if (o.s.z0 <= za + EPS && o.s.z1 >= zb - EPS) material = pzOp(material, o.paths, CT.ctUnion); });
    if (!material.length) continue;
    resto = material;
    S.forEach(function(o, i){
      if (i === 0 || !(o.s.z1 - P <= za + EPS && za < o.s.z1 - EPS)) return; // el tramo no cae en su milimetro de arriba
      var area = pzOp(o.vis, material, CT.ctIntersection);
      if (!area.length) return;
      agregar(piezas[i], area, za, zb);
      resto = pzOp(resto, area, CT.ctDifference);
    });
    agregar(piezas[0], resto, za, zb);
  }
  piezas.forEach(function(p){ delete p._ult; });
  return piezas.filter(function(p, i){ return i === 0 || p.prismas.length; });
}

// Malla de una pieza: todos sus prismas (+ la malla extra, si tiene), sin indice.
function geoDePieza(pieza){
  var trozos = [], total = 0;
  (pieza.prismas || []).forEach(function(pr){
    if (!pr.shapes.length || !(pr.z1 - pr.z0 > 1e-6)) return;
    var g = new THREE.ExtrudeGeometry(pr.shapes, { depth: pr.z1 - pr.z0, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, pr.z0);
    if (g.index) g = g.toNonIndexed();
    trozos.push(g.attributes.position.array); total += g.attributes.position.array.length;
  });
  if (pieza.extra){
    var e = pieza.extra.index ? pieza.extra.toNonIndexed() : pieza.extra;
    trozos.push(e.attributes.position.array); total += e.attributes.position.array.length;
  }
  var pos = new Float32Array(total), off = 0;
  trozos.forEach(function(t){ pos.set(t, off); off += t.length; });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
