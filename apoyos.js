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
// ---- Base encajable: apoyo de mesa en dos piezas ----
// El topper se imprime normal (boca arriba, con relieve) y lleva abajo una lengueta recta de BASE_LENGUETA mm.
// La base se imprime aparte, tal como se usa: una placa baja (BASE_PLACA) con un nervio de BASE_ALTO mm que tiene la
// ranura inclinada donde entra la lengueta; deja el topper inclinado SOLAPA_INCLINACION grados hacia atras.
// La ranura mide grosor + holgura; la lengueta asienta en el fondo de la ranura (los hombros del topper no tocan).
// Para gastar poco material y tiempo, la base es mas angosta que el topper: la lengueta mide lo que dice anchoLengueta.
function anchoLengueta(disponible){ return Math.min(disponible, Math.max(45, Math.min(85, 0.55 * disponible))); }
var BASE_LENGUETA = 10, BASE_ALTO = 14, BASE_PLACA = 2.5, BASE_TAPA = 6;
var BASE_ADELANTE = 18, BASE_ATRAS = 23; // grados de aguante que se buscan al dimensionar la base
var BASE_RELLENO = 0.5; // la base va con relleno: para el equilibrio se cuenta la mitad de su volumen (prudente)
// d = { x0, x1 (extremos de la lengueta), grosor, holgura, alto (alto del topper) }.
// Devuelve la malla de la base en sus propias coordenadas (X = ancho, Y = fondo desde el frente, Z = alto desde la
// mesa) y las medidas de la ranura; fondoAtras = [y, z] del rincon donde asienta la arista de atras-abajo del topper.
function baseEncajable(d){
  var f = SOLAPA_INCLINACION * Math.PI / 180, sn = Math.sin(f), cs = Math.cos(f);
  var Hb = BASE_ALTO, hp = BASE_PLACA, w = d.grosor + d.holgura;
  var L = BASE_LENGUETA - w * sn / cs - 0.3; // hondo de la ranura por su pared de adelante: los hombros quedan 0.3 mm por encima de la base
  // Fondo de la base y sitio de la ranura segun el alto del topper: se supone su centro de masa a media altura y se
  // deja margen para que aguante BASE_ADELANTE grados hacia el frente y BASE_ATRAS hacia atras sin contar el peso de la base.
  var zc = 0.5 * d.alto, dv = zc * cs + 5, du = zc * sn;
  var uS = Math.max(10, dv * Math.tan(BASE_ADELANTE * Math.PI / 180) - du + L * sn - w * cs);
  var Db = Math.min(110, Math.max(40, uS - L * sn + w * cs + du + dv * Math.tan(BASE_ATRAS * Math.PI / 180)));
  var Ft = [uS, Hb], Fb = [uS - L * sn, Hb - L * cs], Rb = [Fb[0] + w * cs, Fb[1] - w * sn], Rt = [uS + w / cs, Hb];
  var ua = uS - 4, ub = Rt[0] + 3.5; // caras del nervio: 4 mm de pared adelante y 3.5 atras, medidas arriba
  function arco(cx, cy, r, a0, a1){ // puntos intermedios y final de un arco (sin el inicial)
    var o = [], n = 5; for (var i = 1; i <= n; i++){ var t = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return o;
  }
  // perfil de lado (u = fondo, v = alto), en sentido antihorario; Rt y Ft quedan seguidos: entre ellos se abre la ranura
  var P = [[0, 0], [Db, 0], [Db, hp - 1.5]].concat(arco(Db - 1.5, hp - 1.5, 1.5, 0, Math.PI / 2), [[ub, hp], [ub, Hb - 2]], arco(ub - 2, Hb - 2, 2, 0, Math.PI / 2));
  var iRt = P.length; P.push(Rt, Ft, [ua + 2, Hb]);
  P = P.concat(arco(ua + 2, Hb - 2, 2, Math.PI / 2, Math.PI), [[ua, hp], [1.5, hp]], arco(1.5, hp - 1.5, 1.5, Math.PI / 2, Math.PI));
  var S = [Ft, Fb, Rb, Rt]; // la ranura (hueco), antihoraria
  var xs0 = d.x0 - d.holgura, xs1 = d.x1 + d.holgura, xa = xs0 - BASE_TAPA, xb = xs1 + BASE_TAPA, X = [xa, xs0, xs1, xb], pos = [];
  function v3(q, x){ pos.push(x, q[0], q[1]); }
  function cuad(A, B, x0, x1, alReves){ // pared entre dos puntos del perfil, de x0 a x1
    if (alReves){ v3(A, x0); v3(B, x1); v3(B, x0); v3(A, x0); v3(A, x1); v3(B, x1); }
    else { v3(A, x0); v3(B, x0); v3(B, x1); v3(A, x0); v3(B, x1); v3(A, x1); }
  }
  function tapa(pol, x, alReves){ // cara plana con la forma de un poligono, mirando a +X (o a -X si alReves)
    var pts = pol.map(function(q){ return new THREE.Vector2(q[0], q[1]); });
    THREE.ShapeUtils.triangulateShape(pts, []).forEach(function(t){
      if (alReves){ v3(pol[t[0]], x); v3(pol[t[2]], x); v3(pol[t[1]], x); } else { v3(pol[t[0]], x); v3(pol[t[1]], x); v3(pol[t[2]], x); }
    });
  }
  for (var i = 0; i < P.length; i++){
    var A = P[i], B = P[(i + 1) % P.length];
    for (var k = 0; k < 3; k++) if (!(i === iRt && k === 1)) cuad(A, B, X[k], X[k + 1], false); // sobre la ranura no hay techo
  }
  for (var j = 0; j < 3; j++) cuad(S[j], S[j + 1], xs0, xs1, true); // paredes y fondo de la ranura
  tapa(S, xs0, false); tapa(S, xs1, true);                          // sus dos extremos
  tapa(P, xa, true); tapa(P, xb, false);                            // costados de la base
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return { geo: geo, fondo: Db, alto: Hb, ancho: xb - xa, ranura: { ancho: w, largo: xs1 - xs0, hondo: L, fondoAtras: Rb, frenteArriba: Ft } };
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
// Estabilidad del topper parado en una mesa: grados que hay que inclinarlo para que el centro de masa se salga de la
// huella de apoyo, hacia adelante (el frente) y hacia atras.
//  - "solapa": datos = { yBase, largo, inclinacion }. La huella va de la arista de atras-abajo de la placa hasta
//    el extremo de la solapa.
//  - "base":   datos = { yFondo, inclinacion, base: { fondo, rincon: [y, z], masa } }. Topper y base cuentan como un
//    solo cuerpo (van encajados); la huella es el fondo de la base.
function estabilidadMesa(piezas, apoyo, datos){
  var m = apMasa(piezas);
  if (!m) return { adelante: 0, atras: 0 };
  var G = 180 / Math.PI, f = datos.inclinacion / G, sn = Math.sin(f), cs = Math.cos(f);
  if (apoyo === "solapa"){
    var dy = m.y - datos.yBase;
    var atrasMm = dy * sn - m.z * cs; // cuanto queda el centro de masa detras de la arista de apoyo
    var alto = dy * cs + m.z * sn;    // altura del centro de masa sobre la mesa
    return { adelante: Math.atan2(atrasMm, alto) * G, atras: Math.atan2(datos.largo - atrasMm, alto) * G };
  }
  if (apoyo === "base"){
    var b = datos.base, dyb = m.y - datos.yFondo;
    var u = b.rincon[0] + dyb * sn - m.z * cs, v = b.rincon[1] + dyb * cs + m.z * sn; // centro de masa del topper, medido desde el frente de la base
    var vb = b.masa.vol * BASE_RELLENO, V = m.vol + vb, U = (u * m.vol + b.masa.y * vb) / V, Z = (v * m.vol + b.masa.z * vb) / V;
    return { adelante: Math.atan2(U, Z) * G, atras: Math.atan2(b.fondo - U, Z) * G };
  }
  return { adelante: 0, atras: 0 };
}
