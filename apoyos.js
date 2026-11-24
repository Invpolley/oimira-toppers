/* OiMira Toppers - apoyos del topper: palitos (torta) y apoyos de mesa. Medidas en mm. */

// Centros de n palitos repartidos parejos en el tramo [xlo, xhi]. Si no caben (menos de 8 mm por palito:
// 6 de ancho + 2 de separacion) se ponen menos; siempre al menos 1.
function posicionesPalitos(n, xlo, xhi){
  n = Math.max(1, Math.round(n) || 1);
  var w = xhi - xlo, o = [];
  while (n > 1 && w / n < 8) n--;
  for (var i = 0; i < n; i++) o.push(xlo + w * (i + 0.5) / n);
  return o;
}
// Cuantos palitos poner: "auto" = la regla de siempre (1 o 2 segun el ancho de la base); "1".."4" = lo pedido.
function cantidadPalitos(sel, auto){
  var n = parseInt(sel, 10);
  if (!(n >= 1)) return auto;
  return Math.min(4, n);
}

/* ---------- Apoyos de mesa ---------- */
function apRecuadro(shapes){
  var c = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  (shapes || []).forEach(function(s){ s.extractPoints(24).shape.forEach(function(p){
    if (p.x < c.x0) c.x0 = p.x; if (p.x > c.x1) c.x1 = p.x; if (p.y < c.y0) c.y0 = p.y; if (p.y > c.y1) c.y1 = p.y; }); });
  return c;
}
function apRect(x0, y0, x1, y1){
  var s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  return s;
}
// y mas baja de la silueta en una x dada (null si la silueta no pasa por esa x)
function apFondo(shapes, px){
  var mejor = null;
  shapes.forEach(function(s){
    var pts = s.extractPoints(24).shape;
    for (var i = 0; i < pts.length; i++){
      var a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a.x - px) * (b.x - px) <= 0 && a.x !== b.x){
        var y = a.y + (b.y - a.y) * (px - a.x) / (b.x - a.x);
        if (mejor === null || y < mejor) mejor = y;
      }
    }
  });
  return mejor;
}
// ---- Solapa trasera: el topper queda como un hablador en L ----
// La placa se inclina SOLAPA_INCLINACION grados hacia atras y de su cara de atras, pegada al borde de abajo, sale una
// solapa plana que descansa en la mesa. Se imprime boca abajo (frente en la cama): la solapa sube casi vertical
// (10° de la vertical), asi que no necesita soportes.
var SOLAPA_INCLINACION = 10, SOLAPA_ESPESOR = 3;
// Borde recto de donde sale la solapa. Si la placa ya tiene uno (rectangulo), se usa: recta = { y, x0, x1 }.
// Si no, se agrega una franja recta bajo la silueta (72 % del ancho, 6 mm por debajo del punto mas bajo, montada 4 mm)
// con tres columnas que suben hasta 6 mm dentro de la silueta real, para que el diseño no cuelgue de una sola letra.
function baseSolapa(silueta, recta){
  if (recta) return { shapes: [], yBase: recta.y, x0: recta.x0, x1: recta.x1 };
  var c = apRecuadro(silueta), W = c.x1 - c.x0, cx = (c.x0 + c.x1) / 2, yBase = c.y0 - 6;
  var x0 = cx - 0.36 * W, x1 = cx + 0.36 * W, shapes = [apRect(x0, yBase, x1, c.y0 + 4)];
  [x0 + 6, cx, x1 - 6].forEach(function(x){
    var fy = apFondo(silueta, x);
    if (fy !== null && fy + 6 > c.y0 + 4) shapes.push(apRect(x - 4, yBase, x + 4, fy + 6));
  });
  return { shapes: shapes, yBase: yBase, x0: x0, x1: x1 };
}
// Malla de la solapa (coordenadas de la placa: z = 0 es la cara de atras). b = { yBase, x0, x1 }; alto = alto del topper.
// Largo = 45 % del alto (entre 35 y 70 mm); las dos esquinas del extremo van redondeadas. Lleva un refuerzo
// triangular de 4 mm por dentro de la L, a todo lo ancho, para que la union no sea solo una arista.
function solapaTrasera(b, alto){
  var f = SOLAPA_INCLINACION * Math.PI / 180, sn = Math.sin(f), cs = Math.cos(f), t = SOLAPA_ESPESOR;
  var F = Math.min(70, Math.max(35, 0.45 * alto)), r = Math.min(8, (b.x1 - b.x0) / 4);
  var sh = new THREE.Shape(); // contorno de la solapa: u = a lo ancho, v = alejandose de la placa
  sh.moveTo(b.x0, 0); sh.lineTo(b.x1, 0); sh.lineTo(b.x1, F - r);
  sh.absarc(b.x1 - r, F - r, r, 0, Math.PI / 2, false); sh.lineTo(b.x0 + r, F);
  sh.absarc(b.x0 + r, F - r, r, Math.PI / 2, Math.PI, false); sh.lineTo(b.x0, 0);
  var losa = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 10 });
  if (losa.index) losa = losa.toNonIndexed();
  var a = losa.attributes.position, pos = [];
  for (var i = 0; i < a.count; i++){ // (u, v, w) -> placa: sale de la arista de atras-abajo, a lo largo de la mesa
    var u = a.getX(i), v = a.getY(i), w = a.getZ(i);
    pos.push(u, b.yBase + v * sn + w * cs, -v * cs + w * sn);
  }
  function tri(p, q, k){ pos.push(p[0], p[1], p[2], q[0], q[1], q[2], k[0], k[1], k[2]); }
  var y3 = b.yBase + t / cs, G = 4; // refuerzo: triangulo entre la cara de atras y la cara de arriba de la solapa
  var A = [b.x0, y3, 0], B = [b.x0, y3 + G, 0], C = [b.x0, y3 + G * sn, -G * cs];
  var A2 = [b.x1, y3, 0], B2 = [b.x1, y3 + G, 0], C2 = [b.x1, y3 + G * sn, -G * cs];
  tri(A, B, C); tri(A2, C2, B2); tri(A, A2, B); tri(A2, B2, B); tri(B, B2, C); tri(B2, C2, C); tri(C, C2, A); tri(C2, A2, A);
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return { geo: g, largo: F };
}
// Volumen (mm3) y centro de masa de un conjunto de piezas (prismas + mallas extra), suponiendo un solo material.
function apMasa(piezas){
  var V = 0, mx = 0, my = 0, mz = 0;
  function anillo(pts, signo, z0, z1){
    var a = 0, cx = 0, cy = 0;
    for (var i = 0; i < pts.length; i++){
      var p = pts[i], q = pts[(i + 1) % pts.length], k = p.x * q.y - q.x * p.y;
      a += k; cx += (p.x + q.x) * k; cy += (p.y + q.y) * k;
    }
    if (Math.abs(a) < 1e-9) return;
    cx /= 3 * a; cy /= 3 * a;
    var v = signo * Math.abs(a) / 2 * (z1 - z0);
    V += v; mx += v * cx; my += v * cy; mz += v * (z0 + z1) / 2;
  }
  piezas.forEach(function(pz){
    (pz.prismas || []).forEach(function(pr){
      pr.shapes.forEach(function(s){
        var e = s.extractPoints(24);
        anillo(e.shape, 1, pr.z0, pr.z1);
        (e.holes || []).forEach(function(h){ anillo(h, -1, pr.z0, pr.z1); });
      });
    });
    if (pz.extra){
      var g = pz.extra.index ? pz.extra.toNonIndexed() : pz.extra, a = g.attributes.position;
      for (var i = 0; i < a.count; i += 3){
        var x1 = a.getX(i), y1 = a.getY(i), z1 = a.getZ(i), x2 = a.getX(i + 1), y2 = a.getY(i + 1), z2 = a.getZ(i + 1), x3 = a.getX(i + 2), y3 = a.getY(i + 2), z3 = a.getZ(i + 2);
        var v = (x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3)) / 6;
        V += v; mx += v * (x1 + x2 + x3) / 4; my += v * (y1 + y2 + y3) / 4; mz += v * (z1 + z2 + z3) / 4;
      }
    }
  });
  return V > 0 ? { vol: V, x: mx / V, y: my / V, z: mz / V } : null;
}
// Estabilidad del topper parado en una mesa con la solapa: grados que hay que inclinarlo para que el centro de masa
// se salga de la huella de apoyo, hacia adelante (el frente) y hacia atras. datos = { yBase, largo, inclinacion }.
// La huella va de la arista de atras-abajo de la placa (adelante) hasta el extremo de la solapa (atras).
function estabilidadMesa(piezas, apoyo, datos){
  var m = apMasa(piezas);
  if (!m || apoyo !== "solapa") return { adelante: 0, atras: 0 };
  var G = 180 / Math.PI, f = datos.inclinacion / G, dy = m.y - datos.yBase;
  var atrasMm = dy * Math.sin(f) - m.z * Math.cos(f); // cuanto queda el centro de masa detras de la arista de apoyo
  var alto = dy * Math.cos(f) + m.z * Math.sin(f);    // altura del centro de masa sobre la mesa
  return { adelante: Math.atan2(atrasMm, alto) * G, atras: Math.atan2(datos.largo - atrasMm, alto) * G };
}
