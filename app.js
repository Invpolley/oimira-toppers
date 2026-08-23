// OiMira Toppers — texto + motivo -> placa 3D plana multicolor -> 3MF / STL (Bambu Lab)
var C = window.TP_CONFIG;
var $ = function(s){ return document.querySelector(s); };
document.getElementById("ver").textContent = C.APP_VERSION;

/* ================= Biblioteca de motivos (siempre imprimen bien) ================= */
var BIBLIOTECA = (function(){
  function n1(v){ return Math.round(v*10)/10; }
  function poly(pts){
    var a = 0; // orientacion consistente: giro positivo (como los circulos)
    for (var i = 0; i < pts.length; i++){ var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (a < 0) pts = pts.slice().reverse();
    return "M"+pts.map(function(p){return n1(p[0])+" "+n1(p[1]);}).join(" L ")+" Z";
  }
  function ell(cx,cy,rx,ry){ var kx=n1(rx*.5523),ky=n1(ry*.5523);
    return "M"+n1(cx-rx)+" "+n1(cy)+" C"+n1(cx-rx)+" "+n1(cy-ky)+" "+n1(cx-kx)+" "+n1(cy-ry)+" "+n1(cx)+" "+n1(cy-ry)+" C"+n1(cx+kx)+" "+n1(cy-ry)+" "+n1(cx+rx)+" "+n1(cy-ky)+" "+n1(cx+rx)+" "+n1(cy)+" C"+n1(cx+rx)+" "+n1(cy+ky)+" "+n1(cx+kx)+" "+n1(cy+ry)+" "+n1(cx)+" "+n1(cy+ry)+" C"+n1(cx-kx)+" "+n1(cy+ry)+" "+n1(cx-rx)+" "+n1(cy+ky)+" "+n1(cx-rx)+" "+n1(cy)+" Z"; }
  function circ(cx,cy,r){ return ell(cx,cy,r,r); }
  function hueco(cx,cy,r){ var k=n1(r*.5523);
    return "M"+n1(cx-r)+" "+n1(cy)+" C"+n1(cx-r)+" "+n1(cy+k)+" "+n1(cx-k)+" "+n1(cy+r)+" "+n1(cx)+" "+n1(cy+r)+" C"+n1(cx+k)+" "+n1(cy+r)+" "+n1(cx+r)+" "+n1(cy+k)+" "+n1(cx+r)+" "+n1(cy)+" C"+n1(cx+r)+" "+n1(cy-k)+" "+n1(cx+k)+" "+n1(cy-r)+" "+n1(cx)+" "+n1(cy-r)+" C"+n1(cx-k)+" "+n1(cy-r)+" "+n1(cx-r)+" "+n1(cy-k)+" "+n1(cx-r)+" "+n1(cy)+" Z"; }
  function rc(x,y,w,h){ return poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]); }
  function star(cx,cy,R,r){ var pts=[]; for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rad=i%2?r:R; pts.push([cx+Math.cos(a)*rad, cy+Math.sin(a)*rad]); } return poly(pts); }
  function heart(cx,cy,s){ function X(v){return n1(cx+v*s);} function Y(v){return n1(cy+v*s);}
    return "M"+X(0)+" "+Y(33)+" C"+X(-8)+" "+Y(22)+" "+X(-35)+" "+Y(7)+" "+X(-35)+" "+Y(-11)+" C"+X(-35)+" "+Y(-27)+" "+X(-17)+" "+Y(-32)+" "+X(-7)+" "+Y(-23)+" C"+X(-3)+" "+Y(-19)+" "+X(0)+" "+Y(-13)+" "+X(0)+" "+Y(-13)+" C"+X(0)+" "+Y(-13)+" "+X(3)+" "+Y(-19)+" "+X(7)+" "+Y(-23)+" C"+X(17)+" "+Y(-32)+" "+X(35)+" "+Y(-27)+" "+X(35)+" "+Y(-11)+" C"+X(35)+" "+Y(7)+" "+X(8)+" "+Y(22)+" "+X(0)+" "+Y(33)+" Z"; }
  function lazo(cx,cy,s){ return [poly([[cx-13*s,cy-7*s],[cx-2*s,cy],[cx-13*s,cy+7*s]]), poly([[cx+13*s,cy-7*s],[cx+2*s,cy],[cx+13*s,cy+7*s]]), circ(cx,cy,3.4*s)]; }
  var oso = [circ(50,28,13), circ(40,17,6), circ(60,17,6), circ(50,60,18), ell(31,54,7,10), ell(69,54,7,10), circ(40,77,6.5), circ(60,77,6.5)];
  var osoDet = [circ(45,25,2), circ(55,25,2), ell(50,31.5,4.5,3.2), circ(40,17,2.4), circ(60,17,2.4)];
  function copo(){ var ds=[circ(50,50,8)];
    for(var i=0;i<6;i++){ var a=i*Math.PI/3, ca=Math.cos(a), sa=Math.sin(a);
      var pt=function(x,y){ return [50+x*ca-y*sa, 50+x*sa+y*ca]; };
      ds.push(poly([pt(-3,0),pt(3,0),pt(3,-38),pt(-3,-38)]));
      ds.push(poly([pt(0,-24),pt(11,-33),pt(8,-38),pt(0,-30)]));
      ds.push(poly([pt(0,-24),pt(-11,-33),pt(-8,-38),pt(0,-30)]));
      var tp=pt(0,-38); ds.push(circ(tp[0],tp[1],4.5)); }
    return ds; }
  var interr = ["M28 28 C28 8 72 8 72 28 C72 42 60 46 56 52 L56 62 L45 62 L45 48 C45 40 56 38 58 30 C59 22 41 22 41 29 L41 32 L28 32 Z", circ(50,74,7)];
  return [
    { nombre:"Osito ♂", tema:"Baby Shower", paths: oso.concat(lazo(50,42,1.3)), detalles: osoDet },
    { nombre:"Osita ♀", tema:"Baby Shower", paths: oso.concat(lazo(40,8,0.9)), detalles: osoDet },
    { nombre:"Cruz ♂", tema:"Bautizo", paths: ["M42 10 L58 10 L58 32 L80 32 L80 48 L58 48 L58 90 L42 90 L42 48 L20 48 L20 32 L42 32 Z"], detalles: ["M46 18 L54 18 L54 38 L72 38 L72 44 L54 44 L54 82 L46 82 L46 44 L28 44 L28 38 L46 38 Z"] },
    { nombre:"Paloma ♀", tema:"Bautizo", paths: [ell(50,52,20,12), circ(67,40,8), poly([[74,37],[82,40],[74,43]]), poly([[40,46],[28,16],[56,42]]), poly([[34,54],[12,68],[18,50]])], detalles: [circ(68,38,2)] },
    { nombre:"Biberón ♂", tema:"Nacimiento", paths: [ell(50,13,6,8), rc(40,19,20,9), rc(36,28,28,52), ell(50,80,14,6)], detalles: [rc(53,36,7,3), rc(53,46,7,3), rc(53,56,7,3)] },
    { nombre:"Piecitos ♀", tema:"Nacimiento", paths: [ell(35,60,13,19), circ(28,40,4.5), circ(35,36.5,5), circ(42,40,5), ell(65,60,13,19), circ(72,40,4.5), circ(65,36.5,5), circ(58,40,5)] },
    { nombre:"¿Niño? ♂", tema:"Revelación", paths: interr.concat(lazo(50,89,1)) },
    { nombre:"¿Niña? ♀", tema:"Revelación", paths: interr.concat(lazo(50,8,1)) },
    { nombre:"Corona ♂", tema:"Rey", paths: ["M12 70 L12 40 L30 52 L50 22 L70 52 L88 40 L88 70 Z","M12 74 L88 74 L88 84 L12 84 Z"], detalles: [circ(30,62,3.6), circ(50,58,4.2), circ(70,62,3.6)] },
    { nombre:"Tiara ♀", tema:"15 Años", paths: ["M12 72 L20 44 L34 58 L50 30 L66 58 L80 44 L88 72 Z", rc(12,72,76,8), circ(20,40,4.5), circ(50,25,5.5), circ(80,40,4.5)], detalles: [circ(35,64,2.8), circ(50,60,3.6), circ(65,64,2.8)] },
    { nombre:"Flecha ♂", tema:"San Valentín", paths: [heart(50,48,1), poly([[13.5,80],[89.5,24],[86.5,20],[10.5,76]]), poly([[94.4,17.3],[91.6,26.8],[84.4,17.2]]), poly([[12,78],[6,84],[9,87],[15,81]]), poly([[9,74],[3,80],[6,83],[12,77]])] },
    { nombre:"Corazones ♀", tema:"San Valentín", paths: [heart(38,42,0.85), heart(66,62,0.55)], detalles: [heart(38,42,0.5)] },
    { nombre:"Árbol", tema:"Navidad", paths: [poly([[50,8],[26,38],[74,38]]), poly([[50,22],[18,60],[82,60]]), poly([[50,42],[12,84],[88,84]]), rc(43,84,14,10), star(50,10,9,4)], detalles: [circ(46,32,3), circ(57,50,3.4), circ(40,54,3), circ(50,70,3.4), circ(64,74,3), circ(35,76,3)] },
    { nombre:"Copo", tema:"Navidad", paths: copo() },
    { nombre:"Torta", tema:"Cumpleaños", paths: ["M20 50 L80 50 L80 85 L20 85 Z M15 46 L85 46 L85 54 L15 54 Z","M47 20 L53 20 L53 36 L47 36 Z M44 36 L56 36 L56 46 L44 46 Z"], detalles: [rc(24,60,52,4), circ(35,74,3), circ(50,74,3), circ(65,74,3)] },
    { nombre:"Globos", tema:"Cumpleaños", paths: ["M35 12 C20 12 12 24 12 35 C12 48 24 58 35 58 C46 58 58 48 58 35 C58 24 50 12 35 12 Z M33 58 L30 70 L40 70 L37 58 Z","M72 25 C62 25 56 33 56 41 C56 50 64 57 72 57 C80 57 88 50 88 41 C88 33 82 25 72 25 Z M70 57 L68 66 L76 66 L74 57 Z"], detalles: [ell(28,26,4,6), ell(66,34,3,4.5)] },
    { nombre:"Birrete", tema:"Graduación", paths: [poly([[50,18],[92,34],[50,50],[8,34]]), rc(36,46,28,16), rc(84,34,4,26), circ(86,64,5)] },
    { nombre:"Diploma", tema:"Graduación", paths: [circ(22,50,11), circ(78,50,11), rc(22,39,56,22), poly([[44,58],[50,74],[56,58]])], detalles: [rc(32,48,36,3)] },
    { nombre:"Anillos", tema:"Boda", paths: [circ(38,55,17), hueco(38,55,10.5), circ(62,55,17), hueco(62,55,10.5), poly([[62,22],[70,30],[62,38],[54,30]])] },
    { nombre:"Campana", tema:"Boda", paths: ["M38 22 C38 12 62 12 62 22 C62 36 66 44 70 50 L30 50 C34 44 38 36 38 22 Z", rc(28,50,44,7), circ(50,62,6)].concat(lazo(50,11,0.8)), detalles: [rc(36,41,28,3)] },
    { nombre:"Cáliz", tema:"Comunión", paths: [circ(50,17,9), "M28 24 L72 24 C72 44 62 54 50 54 C38 54 28 44 28 24 Z", rc(46,54,8,18), rc(32,72,36,8)], detalles: [rc(48.4,11,3.2,12), rc(44,15.4,12,3.2)] },
    { nombre:"Ángel", tema:"Comunión", paths: [circ(50,6,7), hueco(50,6,4), circ(50,20,10), poly([[50,28],[32,72],[68,72]]), ell(26,46,17,9), ell(74,46,17,9)], detalles: [circ(46.5,19,1.7), circ(53.5,19,1.7)] },
    { nombre:"Corbata ♂", tema:"Día del Padre", paths: [poly([[40,12],[60,12],[55,28],[45,28]]), poly([[45,28],[55,28],[62,74],[50,88],[38,74]])], detalles: [poly([[45.5,40],[55,37],[56,41],[46.5,44]]), poly([[46.5,54],[56,51],[57,55],[47.5,58]])] },
    { nombre:"Flor ♀", tema:"Día de la Madre", paths: ["M50 10 C60 10 64 22 57 29 C70 24 79 33 74 44 C69 54 56 51 52 42 L52 42 C56 51 47 60 37 56 C26 51 29 38 39 35 C29 32 28 19 38 14 C43 11 47 10 50 10 Z","M50 46 C55 46 59 50 59 55 C59 60 55 64 50 64 C45 64 41 60 41 55 C41 50 45 46 50 46 Z"], detalles: [circ(50,55,3.6)] },
    { nombre:"Estrella", tema:"Genérico", paths: [star(50,50,42,17)], detalles: [star(50,50,26,10.5)] },
    { nombre:"Mariposa", tema:"Genérico", paths: ["M48 45 C40 28 22 15 12 22 C2 30 12 48 28 52 C14 56 6 70 14 79 C24 88 42 72 48 58 Z","M52 45 C60 28 78 15 88 22 C98 30 88 48 72 52 C86 56 94 70 86 79 C76 88 58 72 52 58 Z","M46 40 L54 40 L54 78 L46 78 Z"], detalles: [ell(28,36,6,8), ell(72,36,6,8), circ(24,66,4), circ(76,66,4)] }
  ];
})();

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
  return opRings(base, det, det ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion);
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

/* ================= Adornos caligraficos (remates bajo el texto) ================= */
var ADORNOS = {
  remolino: { nombre:"Remolino", grosor:4, trazos:[
    "M8 52 C24 34 40 62 56 46 C68 34 84 40 92 52",
    "M8 52 C4 58 10 66 17 62 C22 59 20 52 14 53",
    "M92 52 C96 46 90 38 83 42 C78 45 80 52 86 51"
  ]},
  corazon_inf: { nombre:"Corazon infinito", grosor:4, trazos:[
    "M50 58 C28 42 32 20 45 24 C49 26 50 32 50 36 C50 32 51 26 55 24 C68 20 72 42 50 58",
    "M50 66 C42 76 24 78 18 70 C12 62 22 54 32 60 C38 63 44 66 50 66 C56 66 62 63 68 60 C78 54 88 62 82 70 C76 78 58 76 50 66"
  ]},
  remolino_doble: { nombre:"Doble remolino", grosor:4, trazos:[
    "M50 48 C38 34 20 36 12 46 C6 54 14 64 22 60 C28 57 26 48 19 49",
    "M50 48 C62 34 80 36 88 46 C94 54 86 64 78 60 C72 57 74 48 81 49",
    "M50 48 L50 60"
  ]},
  flecha: { nombre:"Flecha", grosor:3.6, trazos:[
    "M8 50 L92 50", "M78 40 L92 50 L78 60", "M20 40 L10 50 L20 60", "M28 42 L20 50 L28 58"
  ]},
  laurel: { nombre:"Laurel", grosor:3.2, trazos:["M8 62 C30 44 70 44 92 62"],
    paths:["M15 50 L20 46 L25 50 L20 54 Z","M27 45 L32 41 L37 45 L32 49 Z","M39 42 L44 38 L49 42 L44 46 Z","M51 42 L56 38 L61 42 L56 46 Z","M63 45 L68 41 L73 45 L68 49 Z","M75 50 L80 46 L85 50 L80 54 Z"] },
  puntos: { nombre:"Puntos y rombo", grosor:3, trazos:["M14 50 L86 50"],
    paths:["M42 50 L50 43 L58 50 L50 57 Z","M17 50 C17 48.3 18.3 47 20 47 C21.7 47 23 48.3 23 50 C23 51.7 21.7 53 20 53 C18.3 53 17 51.7 17 50 Z","M77 50 C77 48.3 78.3 47 80 47 C81.7 47 83 48.3 83 50 C83 51.7 81.7 53 80 53 C78.3 53 77 51.7 77 50 Z"] }
};
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

  // --- motivo arriba del texto ---
  var motShapes = [];
  if (MOTIVO_SEL){
    var raw = motivoShapes(MOTIVO_SEL);
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

  // --- adorno caligrafico debajo del texto ---
  var adShapes = [];
  var adEl = document.getElementById("adorno");
  var adSel = adEl && adEl.value ? ADORNOS[adEl.value] : null;
  if (adSel && textShapes.length){
    var rawA = adornoShapes(adSel);
    if (rawA.length){
      var abb = shapesBBox(rawA);
      var aw2 = Math.max(abb.max.x - abb.min.x, 1), ah2 = Math.max(abb.max.y - abb.min.y, 1);
      var ka = Math.max(maxW * 0.38, SIZE * 1.1) / aw2;
      if (ah2 * ka > SIZE * 1.05) ka = SIZE * 1.05 / ah2; // que no domine el diseño
      var acx2 = (abb.min.x + abb.max.x) / 2;
      var botY = tb.min.y - ah2 * ka * 0.5 - SIZE * 0.18;
      rawA.forEach(function(s){
        adShapes.push(bakeShape(s,
          function(x){ return (x - acx2) * ka; },
          function(y){ return (y - (abb.min.y + abb.max.y) / 2) * -ka + botY; }
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
    if (motMm.length && textMm.length){
      var mb3 = shapesBBox(motMm);
      bars.push(barra(-1.2, (tb.max.y - ccy) * esc - 2, 1.2, (mb3.min.y + mb3.max.y) / 2));
    }
    if (adMm.length && textMm.length){
      var ab3 = shapesBBox(adMm);
      bars.push(barra(-1.2, (ab3.min.y + ab3.max.y) / 2, 1.2, (tb.min.y - ccy) * esc + 2));
    }
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
      var topP = adMm.length ? (shapesBBox(adMm).min.y + 2) : (last.base + 1);
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
  var gMot = extr(motMm.concat(adMm), dRel); if (gMot && !fullDepth) gMot.translate(0, 0, grosor);
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
["l1","l2","l3","fuente","placa","estiloMot","adorno","ancho","grosor","relieve","palitos","palLen","c1","c2","c3"].forEach(function(id){
  var el = document.getElementById(id);
  el.addEventListener("input", programarRefresco);
  el.addEventListener("change", programarRefresco);
});

/* ================= Motivos: biblioteca + IA ================= */
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
  var partes = [], items = [], objInfo = [], id = 2;
  [["placa","Placa",0],["texto","Texto",1],["motivo","Motivo",2]].forEach(function(p){
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
