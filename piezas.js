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
  if (!n) return [];
  var arbol = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, arbol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return pzDeArbol(arbol);
}
// PolyTree -> Paths, con sus THREE.Shape ya armadas en ._shapes (evita volver a unir para saber que hueco es de quien).
function pzDeArbol(arbol){
  var paths = ClipperLib.Clipper.PolyTreeToPaths(arbol), out = [], min = PZ_AREA_MIN * PZ_ESC * PZ_ESC;
  function v2(p){ return new THREE.Vector2(p.X / PZ_ESC, p.Y / PZ_ESC); }
  function baja(nodo){
    (nodo.Childs() || []).forEach(function(ext){
      var cont = pzSinColineales(ext.Contour().slice());
      if (cont.length > 2 && !pzAstilla(cont, min)){
        var sh = new THREE.Shape(cont.map(v2));
        (ext.Childs() || []).forEach(function(h){
          var hc = pzSinColineales(h.Contour().slice());
          if (hc.length > 2 && !pzAstilla(hc, min)) sh.holes.push(new THREE.Path(hc.map(v2)));
        });
        out.push(sh);
      }
      (ext.Childs() || []).forEach(function(h){ baja(h); }); // islas dentro de un hueco
    });
  }
  baja(arbol);
  paths._shapes = out;
  return paths;
}
function pzOp(a, b, tipo){ // operacion booleana entre dos conjuntos ya normalizados
  if (!a.length) return tipo === ClipperLib.ClipType.ctUnion ? b : [];
  if (!b.length) return tipo === ClipperLib.ClipType.ctIntersection ? [] : a;
  var c = new ClipperLib.Clipper(), sol = new ClipperLib.Paths();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true); c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
// Igual, pero con varios conjuntos por lado (se unen solos con la regla "no cero"): una sola pasada de Clipper.
function pzOpVarios(sujetos, recortes, tipo){
  var c = new ClipperLib.Clipper(), sol = new ClipperLib.Paths(), n = 0;
  sujetos.forEach(function(p){ if (p.length){ c.AddPaths(p, ClipperLib.PolyType.ptSubject, true); n++; } });
  if (!n) return [];
  recortes.forEach(function(p){ if (p.length) c.AddPaths(p, ClipperLib.PolyType.ptClip, true); });
  c.Execute(tipo, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return sol;
}
function pzCaja(paths){ // recuadro de un conjunto de contornos
  var c = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  paths.forEach(function(r){ r.forEach(function(q){ if (q.X < c.x0) c.x0 = q.X; if (q.X > c.x1) c.x1 = q.X; if (q.Y < c.y0) c.y0 = q.Y; if (q.Y > c.y1) c.y1 = q.Y; }); });
  return c;
}
function pzArea(paths){ var a = 0; paths.forEach(function(r){ a += ClipperLib.Clipper.Area(r); }); return a; }
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
  if (paths._shapes) return paths._shapes;
  var c = new ClipperLib.Clipper(), tree = new ClipperLib.PolyTree();
  c.StrictlySimple = true;
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return pzDeArbol(tree)._shapes;
}

// Limpia un area: la encoge 0,02 mm y la vuelve a crecer. Borra agujas, astillas y cuellos mas finos que 0,04 mm
// (ruido de la rejilla al restar regiones, que no se imprime y rompe la triangulacion) y separa contornos que se tocan.
function pzLimpia(paths){
  if (!paths.length) return paths;
  var co = new ClipperLib.ClipperOffset(4, 0.25 * PZ_ESC), e = new ClipperLib.Paths();
  co.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  co.Execute(e, -2);
  if (!e.length) return e;
  var co2 = new ClipperLib.ClipperOffset(4, 0.25 * PZ_ESC), arbol = new ClipperLib.PolyTree();
  co2.AddPaths(e, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  co2.Execute(arbol, 2);
  return pzDeArbol(arbol);
}

// Solidos -> piezas de impresion. La primera pieza es siempre la placa (todo lo que va del color de la placa).
function piezasDeImpresion(solidos, profColor){
  var P = Math.max(1, Number(profColor) || 1), EPS = 1e-6, CT = ClipperLib.ClipType;
  var S = solidos.map(function(s){ var p = pzPaths(s.shapes); p._ok = true; return { s: s, paths: p, vis: null }; }).filter(function(o, i){ return i === 0 || o.paths.length; });
  // Un area que sale de restar o cruzar regiones se limpia una sola vez (las siluetas originales ya vienen limpias).
  function limpia(paths){ if (paths._ok) return paths; var r = pzLimpia(paths); r._ok = true; return r; }
  // 1) region visible de cada solido: su silueta menos lo que tiene encima (mas alto; a igual altura, mas prioridad).
  //    Solo se recorta contra los solidos de encima cuyo recuadro lo toca; la placa (i = 0) no necesita region visible.
  S.forEach(function(o){ o.caja = pzCaja(o.paths); });
  var orden = S.slice().sort(function(a, b){ return (b.s.z1 - a.s.z1) || (b.s.prioridad - a.s.prioridad); });
  orden.forEach(function(o, k){
    o.vis = o.paths;
    if (o === S[0]) return;
    var tapan = orden.slice(0, k).filter(function(t){ return t.caja.x0 < o.caja.x1 && t.caja.x1 > o.caja.x0 && t.caja.y0 < o.caja.y1 && t.caja.y1 > o.caja.y0; });
    if (!tapan.length) return;
    var v = pzOpVarios([o.paths], tapan.map(function(t){ return t.paths; }), CT.ctDifference);
    if (Math.abs(pzArea(v) - pzArea(o.paths)) > 1) o.vis = limpia(v); // si nada lo tapa de verdad, queda su silueta tal cual
  });
  // 2) cortes en z (la placa no necesita corte de color: ya es de su color)
  var cortes = [];
  S.forEach(function(o, i){ cortes.push(o.s.z0, o.s.z1); if (i > 0) cortes.push(Math.max(0, o.s.z1 - P)); });
  cortes = cortes.sort(function(a, b){ return a - b; }).filter(function(z, i, arr){ return i === 0 || z - arr[i - 1] > EPS; });
  // 3) por tramo: material, areas de color y resto (color de la placa). Las areas se guardan por clave: muchos tramos
  //    repiten el mismo material y las mismas areas, y dos tramos seguidos con la misma area forman un solo prisma.
  var piezas = S.map(function(o){ return { rol: o.s.rol, nombre: o.s.nombre, color: o.s.color, prismas: [], extra: null, _ult: null }; });
  var memo = {};
  function guardado(clave, f){ if (!memo[clave]) memo[clave] = f(); return memo[clave]; }
  function seTocan(i, j){ // dos solidos se pisan de verdad (se calcula una vez por pareja)
    var a = S[i].caja, b = S[j].caja;
    if (!(b.x0 < a.x1 && b.x1 > a.x0 && b.y0 < a.y1 && b.y1 > a.y0)) return false;
    return guardado("T" + Math.min(i, j) + "," + Math.max(i, j), function(){ return { si: pzOp(S[i].paths, S[j].paths, CT.ctIntersection).length > 0 }; }).si;
  }
  function agregar(pz, paths, za, zb){
    if (!paths.length) return;
    var u = pz._ult;
    if (u && u.paths === paths && Math.abs(u.pr.z1 - za) < EPS){ u.pr.z1 = zb; return; } // misma area justo debajo: un solo prisma
    if (!paths._shapes) paths._shapes = pzShapes(paths);
    if (!paths._shapes.length) return;
    var pr = { shapes: paths._shapes, z0: za, z1: zb }; pz.prismas.push(pr); pz._ult = { paths: paths, pr: pr };
  }
  for (var k = 0; k + 1 < cortes.length; k++){
    var za = cortes[k], zb = cortes[k + 1], cubre = [];
    S.forEach(function(o, i){ if (o.s.z0 <= za + EPS && o.s.z1 >= zb - EPS) cubre.push(i); });
    if (!cubre.length) continue;
    var cm = "M" + cubre.join(","), sujetos = cubre.map(function(i){ return S[i].paths; });
    function material(){ // union de los solidos que cubren el tramo (solo se calcula si hace falta)
      return guardado(cm, function(){ return cubre.length === 1 ? sujetos[0] : pzOpVarios(sujetos, [], CT.ctUnion); });
    }
    var conColor = [];
    S.forEach(function(o, i){
      if (i === 0 || !(o.s.z1 - P <= za + EPS && za < o.s.z1 - EPS)) return; // el tramo no cae en su milimetro de arriba
      // si el propio solido cubre el tramo, su region visible ya esta dentro del material
      var area = cubre.indexOf(i) >= 0 ? o.vis : guardado("A" + i + cm, function(){ return limpia(pzOp(o.vis, material(), CT.ctIntersection)); });
      if (!area.length) return;
      agregar(piezas[i], area, za, zb);
      conColor.push(i);
    });
    var resto;
    if (!conColor.length) resto = material();
    else {
      // Un solido que cubre el tramo, se ve entero y no toca a ningun otro de los que cubren, se resta a si mismo:
      // se saca de la cuenta (el texto, con miles de puntos, casi siempre cae aqui).
      var solos = conColor.filter(function(i){
        if (cubre.indexOf(i) < 0 || S[i].vis !== S[i].paths) return false;
        return !cubre.some(function(j){ return j !== i && seTocan(i, j); });
      });
      var suj = cubre.filter(function(i){ return solos.indexOf(i) < 0; }), rec = conColor.filter(function(i){ return solos.indexOf(i) < 0; });
      resto = !suj.length ? [] : guardado("R" + suj.join(",") + "-" + rec.join(","), function(){
        return limpia(pzOpVarios(suj.map(function(i){ return S[i].paths; }), rec.map(function(i){ return S[i].vis; }), CT.ctDifference));
      });
    }
    agregar(piezas[0], resto, za, zb);
  }
  piezas.forEach(function(p){ delete p._ult; });
  return piezas.filter(function(p, i){ return i === 0 || p.prismas.length; });
}

// Malla de una pieza: todos sus prismas (+ la malla extra, si tiene), sin indice.
function geoDePieza(pieza){
  var trozos = [], total = 0;
  function suma(g){
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    trozos.push(g); total += g.attributes.position.array.length;
  }
  (pieza.prismas || []).forEach(function(pr){
    if (!pr.shapes.length || !(pr.z1 - pr.z0 > 1e-6)) return;
    var g = new THREE.ExtrudeGeometry(pr.shapes, { depth: pr.z1 - pr.z0, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, pr.z0);
    suma(g);
  });
  if (pieza.extra) suma(pieza.extra);
  var pos = new Float32Array(total), nor = new Float32Array(total), off = 0;
  trozos.forEach(function(g){ pos.set(g.attributes.position.array, off); nor.set(g.attributes.normal.array, off); off += g.attributes.position.array.length; });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return geo;
}
