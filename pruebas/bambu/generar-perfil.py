# Genera bambu-perfil-data.js (se corrio una vez, el 22-11-2026). Uso: python3 generar-perfil.py
# Entradas: ref-1-filamento.project_settings.json (del proyecto guardado por Polley) y claves-perfiles.json
# (claves de los perfiles instalados de Bambu Studio 02.09.01.70). OJO: BAMBU_AJUSTES se edita a mano en el .js.
import json, os
aqui = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(aqui, "ref-1-filamento.project_settings.json"), encoding="utf-8"))
K = json.load(open(os.path.join(aqui, "claves-perfiles.json"), encoding="utf-8-sig"))
F = set(K["filament"])
# de filamento pero definidas solo en el codigo del programa (criterio: ver nota 2026-11-22-bambu-cli.md)
EXTRA = ["enable_overhang_bridge_fan", "enable_pressure_advance", "pressure_advance", "first_x_layer_part_fan_speed", "ironing_fan_speed",
         "overhang_threshold_participating_cooling", "filament_colour", "filament_colour_type", "filament_ids", "filament_multi_colour",
         "filament_map", "filament_nozzle_map", "filament_volume_map", "filament_is_mixed", "filament_mixed_components", "filament_mixed_gradient",
         "filament_mixed_gradient_curve", "filament_mixed_gradient_per_part", "filament_mixed_gradient_range", "filament_mixed_sublayer_ratios",
         "filament_diameter_map"]
por_fil = sorted(k for k, v in d.items() if isinstance(v, list) and ((len(v) in (1, 4, 8) and k in F) or (len(v) == 1 and k in EXTRA)))
por_var = sorted(k for k, v in d.items() if isinstance(v, list) and len(v) == 3 and (k in F or k == "filament_self_index"))
sal = ("// OiMira Toppers - plantilla del proyecto Bambu (generado por pruebas/bambu/generar-perfil.py; no editar a mano salvo BAMBU_AJUSTES).\n"
       "// BAMBU_PERFIL = project_settings.config del proyecto que Polley guardo con Bambu Studio 02.09.01.70 (H2D 0.4, 0.20mm Standard, PLA Basic, 1 filamento).\n"
       "window.BAMBU_PERFIL = " + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + ";\n"
       "// Claves que se repiten al agregar filamentos: una vez por filamento / un trio (3 variantes de extrusor) por filamento.\n"
       "window.BAMBU_CLAVES = " + json.dumps({"porFilamento": por_fil, "porFilamentoVariante": por_var}, separators=(",", ":")) + ";\n"
       "// Ajustes de impresion que se aplican encima de la plantilla (los decide la medicion de tiempo, Tarea 10).\n"
       "window.BAMBU_AJUSTES = {};\n")  # OJO: en el .js publicado BAMBU_AJUSTES se edito a mano (capa 0,25)
open(os.path.join(aqui, "..", "..", "bambu-perfil-data.js"), "w", encoding="utf-8").write(sal)
print(len(por_fil), len(por_var))
