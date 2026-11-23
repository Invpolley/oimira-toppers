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
// Zocalo: franja recta bajo la silueta para que el topper apoye en una linea y los apoyos no tapen el diseño.
// Ocupa el 72 % central del ancho; baja `alto - 2` mm del punto mas bajo y se monta 4 mm sobre la silueta.
function zocalo(plateShapes, alto){
  var c = apRecuadro(plateShapes), ancho = c.x1 - c.x0, cx = (c.x0 + c.x1) / 2;
  var z = { xlo: cx - 0.36 * ancho, xhi: cx + 0.36 * ancho, yBase: c.y0 - alto + 2, yTop: c.y0 + 4 };
  z.shape = apRect(z.xlo, z.yBase, z.xhi, z.yTop);
  return z;
}
// Columnas de 8 mm (en los dos extremos y en el centro) que suben del zocalo hasta 6 mm dentro de la silueta real:
// sin ellas, en un texto con una sola letra baja el zocalo quedaria colgando de esa letra.
function columnasZocalo(silueta, z){
  var out = [];
  [z.xlo + 6, (z.xlo + z.xhi) / 2, z.xhi - 6].forEach(function(x){
    var fy = apFondo(silueta, x);
    if (fy !== null && fy + 6 > z.yTop) out.push(apRect(x - 4, z.yBase, x + 4, fy + 6));
  });
  return out;
}
// Pies delanteros: dos cuñas de 12 mm de ancho sobre la cara del frente (z = grosor), en los extremos del zocalo.
// Seccion: 14 mm de alto junto al borde de abajo y rampa de 45° hasta la placa. Acostado en la cama no tiene voladizos.
function piesDelanteros(z, grosor){
  var L = 14, pos = [];
  function tri(a, b, c){ pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
  [[z.xlo, z.xlo + 12], [z.xhi - 12, z.xhi]].forEach(function(x){
    var A = [x[0], z.yBase, grosor], B = [x[0], z.yBase + L, grosor], C = [x[0], z.yBase, grosor + L];
    var A2 = [x[1], z.yBase, grosor], B2 = [x[1], z.yBase + L, grosor], C2 = [x[1], z.yBase, grosor + L];
    tri(A, C, B); tri(A2, B2, C2);            // tapas laterales
    tri(A, B, A2); tri(B, B2, A2);            // cara que descansa sobre la placa
    tri(A, A2, C); tri(A2, C2, C);            // cara de apoyo en la mesa (borde de abajo)
    tri(B, C, B2); tri(C, C2, B2);            // rampa de 45°
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
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
// Estabilidad del topper parado en una mesa: grados que hay que inclinarlo para que el centro de masa se salga
// de la huella de apoyo, hacia adelante (el frente, +z) y hacia atras. datos = { yBase, grosor }.
function estabilidadMesa(piezas, apoyo, datos){
  var m = apMasa(piezas);
  if (!m) return { adelante: 0, atras: 0 };
  var alto = m.y - datos.yBase, G = 180 / Math.PI;
  if (apoyo === "pie"){ // parado vertical sobre el borde de abajo: la huella va de z = 0 (atras) a z = grosor + 14 (punta de los pies)
    return { adelante: Math.atan2(datos.grosor + 14 - m.z, alto) * G, atras: Math.atan2(m.z, alto) * G };
  }
  return { adelante: 0, atras: 0 };
}
