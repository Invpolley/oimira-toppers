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
