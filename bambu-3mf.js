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
