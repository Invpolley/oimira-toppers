// Perfil H2D de Polley expandido a N filamentos + volumen de purga. Corre en Node (sin navegador).
import fs from "node:fs"; import path from "node:path"; import vm from "node:vm";
import { ok, fin, RAIZ } from "./lib-node.mjs";
const ctx = { window: {}, console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["bambu-perfil-data.js", "bambu-3mf.js"]){
  const p = path.join(RAIZ, f);
  if (!fs.existsSync(p)){ ok(false, "existe " + f); fin(); }
  vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
}
const B = ctx.BAMBU_PERFIL, K = ctx.BAMBU_CLAVES;
ok(B && B.printer_settings_id === "Bambu Lab H2D 0.4 nozzle" && B.version === "02.09.01.70", "plantilla = perfil H2D de Polley");
ok(K && K.porFilamento.length > 90 && K.porFilamentoVariante.length === 44, "clases de claves cargadas");
ok(!/DesignerUserId|C:\\\\|invjp/i.test(fs.readFileSync(path.join(RAIZ, "bambu-perfil-data.js"), "utf8")), "sin datos personales");
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1 color: igual a la base
const u = ctx.expandirPerfil(B, ["#00AE42"], {});
ok(Object.keys(B).every((k) => igual(u[k], B[k])) && Object.keys(u).length === Object.keys(B).length, "1 color: idéntico a la plantilla");
ok(u !== B && u.filament_colour !== B.filament_colour, "no modifica la plantilla (copia)");

// 4 colores
const C4 = ["#F5F5F5", "#D32F2F", "#1565C0", "#1C1C1C"];
const e = ctx.expandirPerfil(B, C4, {});
ok(igual(e.filament_colour, C4) && igual(e.filament_multi_colour, C4), "4 colores: filament_colour y filament_multi_colour");
ok(e.filament_settings_id.length === 4 && e.filament_settings_id.every((x) => x === "Bambu PLA Basic @BBL H2D"), "4 × perfil de filamento");
ok(e.filament_type.length === 4 && e.filament_ids.length === 4 && e.filament_map.length === 4, "tipo, ids y mapa × 4");
ok(e.nozzle_temperature.length === 12 && igual(e.nozzle_temperature.slice(0, 3), e.nozzle_temperature.slice(9, 12)), "nozzle_temperature: 4 tríos");
ok(igual(e.filament_self_index, ["1","1","1","2","2","2","3","3","3","4","4","4"]), "filament_self_index 1,1,1,2,2,2,3,3,3,4,4,4");
ok(e.filament_dev_ams_drying_temperature.length === 32 && e.filament_dev_ams_drying_ams_limitations.length === 16, "claves filament_dev_* × 4");
ok(e.flush_volumes_matrix.length === 32 && e.flush_volumes_vector.length === 8, "matriz 2 × 4×4 y vector 8");
ok(e.nozzle_diameter.length === 2 && e.flush_multiplier.length === 2, "claves por boquilla no cambian");
for (const k of ["upward_compatible_machine", "thumbnail_size", "wipe_tower_x", "wipe_tower_y", "print_compatible_printers", "first_layer_print_sequence", "printable_area", "nozzle_volume"])
  ok(igual(e[k], B[k]), "no se repite la clave de máquina/placa " + k);
const tocadas = new Set(K.porFilamento.concat(K.porFilamentoVariante, ["flush_volumes_matrix", "flush_volumes_vector"]));
ok(Object.keys(B).every((k) => tocadas.has(k) || igual(e[k], B[k])), "ninguna otra clave cambió");
ok(K.porFilamento.every((k) => e[k].length === 4 * B[k].length) && K.porFilamentoVariante.every((k) => e[k].length === 12), "largos por clase de clave");
// matriz: diagonal 0, bloque por boquilla, orden desde -> hacia
const M = e.flush_volumes_matrix.map(Number), at = (b, i, j) => M[b * 16 + i * 4 + j];
ok([0, 1, 2, 3].every((i) => at(0, i, i) === 0 && at(1, i, i) === 0), "diagonal en 0");
ok(at(0, 3, 0) === ctx.volumenPurga("#1C1C1C", "#F5F5F5", 130) && at(0, 0, 3) === ctx.volumenPurga("#F5F5F5", "#1C1C1C", 130), "fila = desde, columna = hacia (boquilla 1, 130)");
ok(at(1, 3, 0) === ctx.volumenPurga("#1C1C1C", "#F5F5F5", 145), "segundo bloque usa el volumen de la boquilla 2 (145)");
ok(at(0, 3, 0) > at(0, 0, 3), "negro→blanco purga más que blanco→negro");

// fórmula (valores calculados a mano)
ok(ctx.volumenPurga("#000000", "#FFFFFF", 130) === 690, "negro→blanco = 560 + 130 = 690");
ok(ctx.volumenPurga("#FFFFFF", "#000000", 130) === 210, "blanco→negro = 80 + 130 = 210");
ok(ctx.volumenPurga("#D32F2F", "#D32F2F", 130) === 190, "mismo color = mínimo 60 + 130");
ok(ctx.volumenPurga("#d32f2f", "#1565C0", 130) > 190 && ctx.volumenPurga("#000000", "#FFFFFF", 500) === 900, "tono distinto purga más; tope 900");
ok(e.flush_volumes_matrix.every((x) => /^\d+$/.test(x)), "valores enteros como texto");

// ajustes encima
const a = ctx.expandirPerfil(B, C4, { layer_height: "0.25" });
ok(a.layer_height === "0.25" && B.layer_height === "0.2", "los ajustes se aplican al final sin tocar la plantilla");
fin();
