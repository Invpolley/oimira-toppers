# Toppers: palitos a elegir, apoyos de mesa, proyecto Bambu y ahorro de tiempo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (meta):** que la app OiMira Toppers descargue un proyecto de Bambu Studio listo para imprimir (una pieza, cada parte con su filamento), permita elegir 1–4 palitos o un apoyo de mesa (pie delantero, pata trasera a 45°) y gaste menos tiempo de impresión, medido con Bambu Studio real.

**Architecture (cómo):** `construir()` deja de entregar mallas por color y entrega una lista de **sólidos** (silueta 2D + alturas + color). Un módulo nuevo convierte esos sólidos en **piezas de impresión** aplicando la regla de profundidad de color; la vista 3D, el STL y el 3MF salen de esas mismas piezas (lo que se ve es lo que se descarga). El 3MF lo escribe un módulo aparte que toma como plantilla el perfil real de Polley y lo expande a N filamentos. Los apoyos viven en su propio módulo.

**Tech Stack:** JavaScript sin compilar (scripts globales, igual que hoy), three.js r128, ClipperLib 6.4.2, JSZip 3.10.1, GitHub Pages. Pruebas: Node + Playwright (Chromium) contra un servidor local, Supabase siempre simulado. Verificación externa: Bambu Studio 02.09.01.70.

**Spec:** `docs/superpowers/specs/2026-11-22-palitos-tripode-bambu-design.md` (aprobado por Polley el 22-11-2026). Quien ejecuta lee el diseño y este plan.

## Datos confirmados del proyecto real de Polley (`topper-feliz-cumpleanos2.3mf`)

- Bambu Studio **02.09.01.70**; impresora **Bambu Lab H2D 0.4 nozzle** (dos boquillas 0,4; cama 350×320); proceso **0.20mm Standard @BBL H2D**; filamento **Bambu PLA Basic @BBL H2D**; placa **Textured PEI Plate**; reparto de boquillas **Auto For Flush**.
- Causa del problema de hoy: el proyecto trae **un solo filamento** (`#00AE42`) y ninguna de las 5 partes tiene la clave `extruder`. Todo sale con el filamento 1.
- Estructura del archivo: `3D/3dmodel.model` (objeto contenedor con `<components>` que apuntan a `/3D/Objects/object_1.model`), `3D/_rels/3dmodel.model.rels`, `Metadata/model_settings.config` (`<object>` → `<part id subtype="normal_part">` con `name`, `matrix`, `mesh_stat`; `<plate>`; `<assemble>`), `Metadata/project_settings.config` (JSON, 636 claves), `Metadata/slice_info.config`, `Metadata/cut_information.xml`, `Metadata/filament_sequence.json`, miniaturas PNG.
- En `project_settings.config` hay 124 listas de largo 1 (las de filamento están entre ellas, mezcladas con algunas de máquina), 44 de largo 3 (filamento × 3 variantes de extrusor) y `flush_volumes_matrix` / `flush_volumes_vector` tienen largo 2 con un filamento. No contiene datos personales (revisado).
- Bambu Studio está instalado en el PC de Polley en `C:\Program Files\Bambu Studio\bambu-studio.exe`.

**No confirmado todavía (lo resuelve la Tarea 2, no se da por cierto):** que Bambu Studio acepte `extruder` por parte tal como se escribe aquí; qué opciones exactas tiene su modo de línea de comandos en esta versión; cómo trata los volúmenes de purga de un proyecto generado fuera del programa; si respeta ajustes de proceso cambiados sin pedir confirmación.

**Cambio respecto al diseño (requiere el sí de Polley):** el diseño preveía instalar Bambu Studio para Linux en el espacio de trabajo de Claude. La descarga está bloqueada en esta sesión (GitHub responde 403 para `bambulab/BambuStudio`). Alternativa de este plan: usar el Bambu Studio del PC de Polley en modo línea de comandos (sin ventanas, sobre copias en una carpeta de pruebas). Si Polley prefiere que no, la verificación pasa a ser: él abre los archivos de prueba y dice qué ve.

## Global Constraints

- Interfaz en español, código en inglés donde sea nuevo; fechas DD-MM-AAAA; no se inventan datos: lo que no se pudo comprobar se dice.
- No se cambia el editor (texto, figuras, adornos, colecciones, "Guíame"). No se lamina ni se imprime desde la app.
- La profundidad del color nunca baja de **1,0 mm**.
- Los bocetos guardados y los 12 modelos conservan la **misma silueta de frente**; el campo `palitos` (true/false) se sigue escribiendo.
- Apoyos de mesa: una sola pieza, sin soportes de impresión (ninguna cara con voladizo de más de 45°).
- Lista de filamentos del proyecto = solo los colores usados, sin repetir, **placa primero**; todos PLA; sin límite de cantidad.
- Las pruebas no escriben en datos reales: toda petición a `*.supabase.co` se simula. Nunca se imprimen claves ni tokens; la salida de `git push` se filtra con `-replace 'https://[^@\s]+@','https://<oculto>@'`.
- Nada personal en archivos públicos: de la plantilla de Polley no se copia `DesignerUserId` ni rutas del PC.
- Trabajo en la rama `apoyos-bambu`; respaldo = etiqueta git `respaldo-v2026-11-11.1` sobre el commit `05ec754`. Cada entrega se une a `main` por separado (GitHub Pages publica `main`).
- Cada publicación sube `APP_VERSION` (`config.js`), `CACHE` (`sw.js`), el `?v=` de cada script tocado y agrega los scripts nuevos a `ASSETS` de `sw.js`. Antes de publicar se lee la skill `oimira-pwas`.
- Git se ejecuta en el PC con PowerShell (el shell Linux del PC no puede borrar archivos y deja bloqueos de git).

## Review Focus

Casos que el diseño implica pero no pide probar, del más probable al menos:

1. **Boceto viejo abierto después de uno nuevo**: no debe heredar apoyo, cantidad ni profundidad del diseño anterior; abre con Palitos / Auto. → prueba en Tarea 6.
2. **Colores repetidos o iguales a la placa** (texto y borde blancos; una capa PRO del color de la placa; `#FFF` vs `#ffffff`): un solo filamento por color, ninguna parte vacía, el archivo abre. → Tarea 4.
3. **Texto con `&`, `<`, comillas o tildes** en la línea 1 (va al título y nombres del proyecto): el XML sigue siendo válido. → Tarea 4.
4. **Diseño angosto u hueco con un apoyo que no cabe** (60 mm con 4 palitos; pata en un aro calado): se pone lo que cabe y se avisa; nunca palitos encimados ni pata en el aire. → Tareas 6 y 14.
5. **Figura o adorno arrastrado fuera de la placa** (óvalo/rectángulo): las piezas siguen siendo sólidos cerrados y la regla de color no falla donde no hay placa debajo. → Tarea 8.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app.js` (modificar) | `construir()` arma sólidos y llama a los módulos; vista 3D; estado guardado; botones de exportar |
| `piezas.js` (nuevo) | Regla de profundidad de color: sólidos → piezas de impresión → mallas |
| `apoyos.js` (nuevo) | Posiciones de palitos, zócalo, pies delanteros, pata trasera, estabilidad |
| `bambu-3mf.js` (nuevo) | Escribe el proyecto Bambu a partir de partes + perfil |
| `bambu-perfil-data.js` (nuevo) | `window.BAMBU_PERFIL` (plantilla saneada del proyecto de Polley) y `window.BAMBU_AJUSTES` |
| `index.html`, `sw.js`, `config.js`, `modelos-data.js` (modificar) | Controles nuevos, scripts, caché, versión, relieve 1,0 |
| `pruebas/` (nuevo) | `servidor.mjs`, `lib.mjs`, `t-*.mjs`, `base/` (línea base), `bambu/` (laminado real) |

Tipos compartidos (objetos simples):

```js
// Solido: lo que construir() describe. z en mm, 0 = cara de atrás de la placa.
{ rol: "placa"|"texto"|"motivo"|"adorno"|"borde"|"capa", nombre: string, color: "#rrggbb",
  shapes: THREE.Shape[], z0: number, z1: number, prioridad: number } // empate de altura: gana prioridad mayor
// Pieza: lo que se imprime de un color.
{ rol: string, nombre: string, color: "#rrggbb", prismas: [{ shapes: THREE.Shape[], z0: number, z1: number }],
  extra: THREE.BufferGeometry|null }   // extra = malla que no es prisma (pies, pata)
// Parte: lo que recibe el escritor 3MF.
{ nombre: string, color: "#rrggbb", geo: THREE.BufferGeometry }
```

---

# ENTREGA 1 — Proyecto Bambu + cantidad de palitos

### Task 1: Banco de pruebas, rama y línea base

**Files:** Create `pruebas/servidor.mjs`, `pruebas/lib.mjs`, `pruebas/t-base.mjs`, `pruebas/base/siluetas.json`, `pruebas/base/boceto-viejo.json`.

**Interfaces — Produces:**
- `abrirApp({ raiz: string }) → Promise<{ page, cerrar() }>`: sirve `raiz` en `127.0.0.1`, simula `*.supabase.co` (GET → `[]`, POST → `{}`), espera a que exista `window.GEOS`.
- `aplicar(page, diseno) → Promise<void>`: `aplicarDiseno(diseno)` y espera fuente + `refrescar()`.
- `huella(page) → Promise<object>`: por cada clave de `GEOS.d2` (placa, texto, motivo, adorno, borde) `{ area, bbox }` de la unión, redondeado a 0,01 mm, más `anchoMm`, `altoMm`.
- `ok(cond, nombre)`, `fin()` (imprime `N comprobaciones OK`, sale con 1 si alguna falló).

- [ ] **Step 1:** En el PC: `git tag respaldo-v2026-11-11.1 05ec754`, `git switch -c apoyos-bambu`, y commit del diseño (`docs/superpowers/specs/…`) y de este plan.
- [ ] **Step 2:** Escribir `servidor.mjs` y `lib.mjs` (Playwright en `/opt/npm-tools/node_modules/playwright/index.mjs`, `chromium.launch({proxy:{server:process.env.HTTPS_PROXY}})`, variable `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1`).
- [ ] **Step 3:** Con el código **sin tocar**, `t-base.mjs --grabar` guarda en `base/siluetas.json` la `huella` de: los 12 modelos (`aplicarModelo`), y las 5 formas de placa con el texto "Feliz / Cumpleaños" con y sin palitos. Guarda en `base/boceto-viejo.json` el `estadoDiseno()` de un diseño con `palitos:true`, relieve 1,2 y borde.
- [ ] **Step 4:** Run `node pruebas/t-base.mjs` → `22 comprobaciones OK` (12 modelos + 10 formas comparadas contra lo grabado).
- [ ] **Step 5:** Commit `test: banco de pruebas y línea base de siluetas`.

### Task 2: Laminado real con Bambu Studio (averiguación con resultado escrito)

Solo si Polley aceptó usar su Bambu Studio por línea de comandos. Si no, esta tarea se reduce al Step 4 hecho a mano por él.

**Files:** Create `pruebas/bambu/laminar.ps1`, `docs/superpowers/notas/2026-11-22-bambu-cli.md`.

**Interfaces — Produces:** `laminar.ps1 -Entrada <ruta.3mf> -Salida <carpeta>` → escribe `<carpeta>\resultado.json` con `{ ok, error, segundos, gramos, filamentos:[{id,color,gramos}], cambiosFilamento, soportes:boolean, partes:[{nombre,extruder}] }`. Trabaja siempre sobre copias en `C:\Users\invjp\Documents\inversionespolley\_pruebas_toppers\`; no abre ventanas; no toca la configuración del programa.

- [ ] **Step 1:** Ejecutar `bambu-studio.exe --help` y anotar en la nota las opciones reales de esta versión para laminar y exportar el 3MF laminado.
- [ ] **Step 2:** Laminar `topper-feliz-cumpleanos2.3mf` (copia). Anotar de dónde salen tiempo, gramos y cambios de filamento (archivo y clave exactos). Expected: `ok:true`, 1 filamento, 0 cambios.
- [ ] **Step 3:** Escribir `laminar.ps1` con lo averiguado. Run sobre el mismo archivo → `resultado.json` con `segundos > 0`.
- [ ] **Step 4:** Conseguir `pruebas/bambu/ref-6-filamentos.3mf`: un proyecto **escrito por el propio Bambu Studio** con los 6 colores de la tienda como filamentos (Blanco `#F5F5F5`, Negro `#1C1C1C`, Rojo `#D32F2F`, Azul `#1565C0`, Amarillo `#FBC02D`, Rosado `#F48FB1`) y una parte asignada al filamento 2. Primero se intenta por línea de comandos (si el Step 1 mostró una opción para cargar filamentos y exportar el proyecto); si no se puede, se le pide a Polley que lo guarde a mano (una sola vez). De ahí se anotan: cómo queda `extruder` en la parte y qué claves de `project_settings.config` cambiaron de largo respecto al proyecto de 1 filamento.
- [ ] **Step 5:** Commit `docs: cómo laminar con Bambu Studio real` (nota + script).

### Task 3: Plantilla de perfil y expansión a N filamentos

**Files:** Create `bambu-perfil-data.js`; Test `pruebas/t-perfil.mjs`.

**Interfaces — Produces:**
- `window.BAMBU_PERFIL`: el JSON de `project_settings.config` de Polley, tal cual.
- `window.BAMBU_AJUSTES = {}` (se llena en la Tarea 10).
- `expandirPerfil(perfilBase, colores: string[], ajustes: object) → object`.
- `volumenPurga(desde: "#RRGGBB", hacia: "#RRGGBB") → number` (mm³, entero).

- `window.BAMBU_CLAVES = { porFilamento: string[], porFilamentoVariante: string[] }`: qué claves se repiten por filamento. **No se deduce por el nombre**: se obtiene comparando los largos de cada lista entre el proyecto de 1 filamento y `ref-6-filamentos.3mf` (1→6 = `porFilamento`; 3→18 = `porFilamentoVariante`). En el archivo de Polley hay 124 listas de largo 1 y no todas son de filamento (por ejemplo `upward_compatible_machine`, `thumbnail_size`, `wipe_tower_x`, `print_compatible_printers`), por eso hace falta la referencia. Si aparece una clave con otro cambio de largo que no esté en las reglas de abajo, se detiene la tarea y se anota.

Reglas de `expandirPerfil` para N colores: las claves `porFilamento` se repiten N veces; las `porFilamentoVariante`, N veces el trío (3N); `filament_colour` y `filament_multi_colour` = colores; `filament_self_index` = `"1","1","1","2","2","2",…`; `filament_map` y `flush_volumes_vector` con el patrón que muestre la referencia; `flush_volumes_matrix` = dos bloques N×N (uno por boquilla) con `volumenPurga(i, j)` y 0 en la diagonal; el resto no se toca; al final se aplican `ajustes` encima.

- [ ] **Step 1: Test** `t-perfil.mjs`: con 1 color el resultado es idéntico a `BAMBU_PERFIL` salvo `filament_colour`/`filament_multi_colour`; con los 6 colores de la tienda el resultado es **igual clave por clave** al `project_settings.config` de `ref-6-filamentos.3mf` (se admite ±1 en `flush_volumes_matrix`); con 4 colores: `filament_colour.length === 4`, `nozzle_temperature.length === 12`, `filament_self_index` = `1,1,1,2,2,2,3,3,3,4,4,4`, `flush_volumes_matrix.length === 32`, `nozzle_diameter.length === 2`.
- [ ] **Step 2:** Run → FAIL (`expandirPerfil is not defined`).
- [ ] **Step 3:** Implementar. `volumenPurga` se porta de `FlushVolCalculator` del código abierto de Bambu Studio (leer la fuente; no se escribe de memoria). Si la fuente no se puede leer o no coincide con los valores de la referencia, se usa una tabla fija con los valores reales de la referencia para pares de la paleta y, para colores fuera de ella, el máximo de la tabla; se anota en la nota de la Tarea 2 cuál de los dos caminos quedó.
- [ ] **Step 4:** Run → PASS. Comprobar que el archivo no contiene `DesignerUserId`, `C:\`, ni `invjp`.
- [ ] **Step 5:** Commit `feat: plantilla de perfil H2D y expansión a N filamentos`.

### Task 4: Escritor del proyecto Bambu

**Files:** Create `bambu-3mf.js`; Test `pruebas/t-3mf.mjs`.

**Interfaces — Consumes:** `expandirPerfil` (Task 3). **Produces:**
- `filamentosDe(partes: Parte[]) → { colores: string[], deParte: number[] }`: colores en `#RRGGBB` mayúsculas, sin repetir (comparación sin distinguir mayúsculas y expandiendo `#abc`), en orden de aparición; `deParte[i]` = número de filamento (desde 1) de `partes[i]`. La placa es siempre `partes[0]`.
- `construirProyectoBambu({ titulo: string, partes: Parte[], perfilBase: object, ajustes: object }) → Promise<Blob>`.

Contenido que escribe (copiado de la estructura del archivo de Polley): `[Content_Types].xml`; `_rels/.rels`; `3D/3dmodel.model` con `Application` = `BambuStudio-02.09.01.70`, `BambuStudio:3mfVersion` = `1`, `Title` = título, un objeto contenedor de id N+1 con un `<component objectid="k" transform="1 0 0 0 1 0 0 0 1 0 0 0">` por parte, y `<item>` con transform `1 0 0 0 1 0 0 0 1 175 160 0`; `3D/_rels/3dmodel.model.rels`; `3D/Objects/object_1.model` con un `<object id="k" type="model"><mesh>` por parte (vértices soldados a 3 decimales, malla desplazada para que el centro XY del conjunto sea 0,0 y z mínima 0); `Metadata/model_settings.config` con `<object id="N+1">` (`name`, `extruder`=1) y por parte `<part id="k" subtype="normal_part">` con `name`, `matrix` identidad, **`extruder` = `deParte[k-1]`**, `mesh_stat`; `<plate>` con `filament_map_mode` = `Auto For Flush` y `model_instance`; `<assemble>`; `Metadata/project_settings.config` = `expandirPerfil(…)`; `Metadata/slice_info.config`, `Metadata/cut_information.xml`, `Metadata/filament_sequence.json` como en la referencia. UUID con forma válida generados de forma determinista por índice. Sin miniaturas. Las partes sin triángulos se omiten.

- [ ] **Step 1: Test** `t-3mf.mjs` (el blob se abre en la página con `JSZip.loadAsync`): con 3 partes de colores `#f5f5f5`, `#D32F2F`, `#F5F5F5` → `filamentosDe` da `colores = ["#F5F5F5","#D32F2F"]`, `deParte = [1,2,1]`; el zip contiene las 9 rutas de arriba; los dos `.model` y `model_settings.config` pasan por `DOMParser` sin `parsererror`; hay 3 `<part>` con `extruder` 1, 2, 1; `project_settings.filament_colour` = los 2 colores; título `Feliz & "Cía" <3` no rompe el XML; una parte con `geo` vacía no aparece; z mínima de todos los vértices = 0.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: escritor de proyecto Bambu`.

### Task 5: Conectar la exportación y comprobar con el programa real

**Files:** Modify `app.js` (`construir3mf` 957–986, `$("#btn3mf").onclick` 996–1003, `abrirExportar` 1730–1751), `index.html` (scripts tras `modelos-data.js`: `bambu-perfil-data.js?v=1`, `bambu-3mf.js?v=1`).

**Interfaces — Produces:** `partesParaExportar() → Parte[]` en `app.js`: en esta entrega, las mallas de hoy en este orden: Placa (`c1`), Texto (`c2`), Figura (`c3`) o "Figura capa i" (color de la capa), Adorno (`c4`), Borde (`c5`). `construir3mf()` pasa a ser `construirProyectoBambu({ titulo: nombreArchivo(""), partes: partesParaExportar(), perfilBase: BAMBU_PERFIL, ajustes: BAMBU_AJUSTES })`. Se borra `geoXml`.

- [ ] **Step 1: Test** `t-exportar.mjs`: con el modelo 1, el blob de `construir3mf()` tiene tantas `<part>` como partes visibles y el resumen del modal dice `N filamentos` con N = colores distintos; si `c2` no está en `FILAMENTOS`, el resumen contiene `no está en tus filamentos`; el botón STL sigue generando un zip.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar (resumen: muestra una muestra de color por filamento, no por parte). **Step 4:** Run → PASS; `node pruebas/t-base.mjs` → PASS.
- [ ] **Step 5 (programa real):** exportar el diseño "Feliz Cumpleaños" de Polley, `laminar.ps1` → Expected `ok:true`, `partes` con el `extruder` esperado, tantos `filamentos` como colores, `soportes:false`. Guardar `resultado.json` como `pruebas/bambu/antes.json` (es la medida "antes" de la Entrega 2: geometría de hoy con colores asignados).
- [ ] **Step 6:** Commit `feat: la descarga es un proyecto Bambu con filamento por parte`.

### Task 6: Selector de apoyo y cantidad de palitos

**Files:** Create `apoyos.js`; Modify `app.js` (`construir` 556–666, `estadoDiseno` 1261–1273, `aplicarDiseno` 1274–1296, `abrirExportar`), `index.html` (fila de `#palitos`, líneas 306–309); Test `pruebas/t-palitos.mjs`.

**Interfaces — Produces:**
- HTML: `<select id="apoyo">` con `palitos` (por defecto) y `ninguno` (las opciones `pie` y `pata` llegan en las Tareas 12 y 14); `<select id="palN">` con `auto,1,2,3,4`; `#palLen` se conserva; `#palN` y `#palLen` solo se ven con `apoyo = palitos`; `<input type="checkbox" id="palitos">` queda oculto y sincronizado (`checked = apoyo === "palitos"`). Aviso en `<div id="apoyoMsg" class="msg">`.
- `posicionesPalitos(n: number, xlo: number, xhi: number) → number[]`: centros en `xlo + (xhi-xlo)*(i+0.5)/n`; si `(xhi-xlo)/n < 8` reduce n hasta que quepa (mínimo 1).
- `cantidadPalitos(sel: "auto"|"1".."4", auto: number) → number`.
- `estadoDiseno().campos` gana `apoyo`, `palN`, `profColor`; `o.palitos` se sigue escribiendo.
- `aplicarDiseno(o)`: si `o.campos.apoyo` falta → `apoyo = o.palitos ? "palitos" : "ninguno"`, `palN = "auto"`, `profColor = "1.0"` (se asignan siempre, no se deja el valor anterior de la pantalla).

Tramo `[xlo, xhi]` por forma, elegido para que n = 2 dé exactamente las posiciones de hoy: contorno = tramo inferior actual (puntos con `y < min+9`); letras = `±last.hw`; aro = `±0.7R`; óvalo y rectángulo = `±0.52·plateWmm`. "Auto" = regla de hoy (contorno: 1 si el tramo mide menos de 26, si no 2; letras: 2 si `last.hw > 16`, si no 1; resto: 2). En contorno, si `fondoEnX` no encuentra silueta en una posición, se prueba a ±1, ±2 … ±10 mm y se usa la primera que sí. Si se ponen menos de los pedidos: `#apoyoMsg` = `Solo caben N palitos en este diseño.`

- [ ] **Step 1: Test** `t-palitos.mjs`: `posicionesPalitos(2,-50,50)` = `[-25,25]`; `(4,-50,50)` = `[-37.5,-12.5,12.5,37.5]`; `(4,0,20)` devuelve 2 posiciones; para cada forma × n ∈ {1,2,3,4}: `GEOS.d2.nPalitos === n`, `comprobarUniones().ok`, y los palitos no se enciman (distancia entre centros ≥ 8); texto "Hi" a 60 mm con 4 pedidos → menos de 4 y aviso visible; con `palN=auto` las 22 huellas de la línea base no cambian; aplicar un diseño con `apoyo:"ninguno", palN:"3"` y luego `base/boceto-viejo.json` → `#apoyo` = `palitos`, `#palN` = `auto`, huella igual a la grabada; `estadoDiseno().palitos` es `true` con palitos y `false` sin apoyo.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: apoyo a elegir y de 1 a 4 palitos`.

### Task 7: Publicar la entrega 1

- [ ] **Step 1:** Todas las pruebas `pruebas/t-*.mjs` → PASS. Versión: `APP_VERSION` con la fecha del día, `CACHE = "toppers-v17"`, `app.js?v=34`, scripts nuevos en `ASSETS`.
- [ ] **Step 2:** Enviar a Polley un 3MF de prueba; él lo abre en su Bambu Studio y confirma: una pieza, colores visibles, el AMS pide todos los filamentos, no hubo que reasignar nada.
- [ ] **Step 3:** Con su confirmación: unir a `main`, `git push` (salida filtrada), comprobar en `invpolley.github.io/oimira-toppers` la versión nueva y repetir `t-exportar.mjs` contra el sitio publicado.

---

# ENTREGA 2 — Profundidad de color + ahorro de tiempo

### Task 8: Sólidos y regla de profundidad de color

**Files:** Create `piezas.js`; Modify `app.js` (`construir` 668–722); Test `pruebas/t-piezas.mjs`.

**Interfaces — Produces:**
- `construir()` agrega al resultado `solidos: Solido[]`: placa `{z0:0, z1:grosor, prioridad:0}`; borde, adorno, motivo, texto con `z1 = grosor+relieve`, `z0 = fullDepth ? 0 : grosor`, prioridades 1, 2, 3, 4; cada capa PRO i con `z0 = grosor`, `z1 = grosor + (i+1)*0.45`, prioridad `10+i`, su color. Las claves de hoy (`placa`, `texto`, …, `d2`) se conservan.
- `piezasDeImpresion(solidos: Solido[], profColor: number) → Pieza[]`: la primera pieza es siempre la de la placa.
- `geoDePieza(pieza: Pieza) → THREE.BufferGeometry` (todos los prismas + `extra`, sin índice).

Algoritmo (no lo fijan la firma ni las pruebas): (1) región visible de cada sólido = su silueta menos la unión de las siluetas de los sólidos con `z1` mayor (o igual y más prioridad), con Clipper. (2) Cortes en z = todos los `z0`, `z1` y `z1 - profColor` (≥ 0), ordenados. (3) Por cada tramo entre cortes: material = unión de siluetas de los sólidos que cubren el tramo; para cada sólido cuyo tramo cae dentro de su milímetro superior (`z1 - profColor ≤ za < z1`), área de su color = su región visible ∩ material; lo que queda del material es del color de la placa. (4) Cada área no vacía es un prisma `[za, zb]` de la pieza de ese rol; todo lo del color de la placa va a la pieza "Placa". `profColor` se toma como `Math.max(1, valor)`.

- [ ] **Step 1: Test** `t-piezas.mjs`. Para cada forma de placa, con relieve 0,6 / 1,0 / 1,2 / 3,0, con y sin motivo PRO, y un caso con la figura arrastrada fuera de un óvalo: se toman 400 puntos al azar (semilla fija) en el recuadro; en cada punto, con punto-en-polígono sobre los prismas: (a) los tramos de las piezas no se solapan; (b) su unión es igual a la columna de los sólidos originales; (c) el milímetro superior de la columna (o toda, si mide menos) es del color del sólido visible; (d) el resto es del color de la placa. Además: cada prisma, extruido, es una malla cerrada (cada arista compartida por exactamente 2 triángulos) de volumen > 0; con relieve 1,0 y forma contorno, la pieza "Texto" es un solo prisma `[grosor, grosor+1]`; con `profColor` 0,4 el resultado es igual que con 1,0.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: regla de profundidad de color (1 mm)`.

### Task 9: Vista 3D y descargas desde las piezas; relieve 1,0

**Files:** Modify `app.js` (`refrescar` 745–774, arrastre 786–818, `partesParaExportar`, `$("#btnStl").onclick`, `estadoDiseno`), `index.html` (`#relieve` value 1.0; campo nuevo `<input id="profColor" type="number" value="1.0" min="1" max="3" step="0.2">` con etiqueta "Profundidad del color"), `modelos-data.js` (12 × `relieve:"1.2"` → `"1.0"`; `?v=3`), `index.html` (`piezas.js?v=1` antes de `app.js`).

**Interfaces — Produces:** `GEOS.piezas: Pieza[]`. `refrescar()` crea una malla por pieza con `userData.rol`. El arrastre toma como candidatas las mallas con rol `motivo`/`capa` (mueve la figura) o `adorno`, y mueve todas las de ese rol. `partesParaExportar()` = `GEOS.piezas.map(p => ({ nombre: p.nombre, color: p.color, geo: geoDePieza(p) }))`. El zip de STL lleva un archivo por pieza (`1-placa.stl`, `2-texto.stl`, …).

- [ ] **Step 1: Test** `t-vista.mjs`: tras `aplicarModelo` de cada uno de los 12 modelos, las huellas `d2` coinciden con la línea base y `#relieve` vale `1.0`; `base/boceto-viejo.json` conserva `#relieve` = `1.2` y su huella; `grupo.children` tiene una malla por pieza; arrastrar la figura (eventos `pointerdown/move/up` sobre su centro) cambia `MOT_OFF` y no `AD_OFF`, también con una figura PRO; forma aro: la pieza "Texto" mide 1 mm de alto y el 3MF tiene `extruder` 1 en la pieza Placa; `refrescar()` con 3 líneas + figura PRO tarda menos de 400 ms; `#profColor` no acepta menos de 1 (al escribir 0,5 se exporta con 1).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS, y `t-base`, `t-palitos`, `t-exportar` → PASS.
- [ ] **Step 5:** Commit `feat: vista y descargas salen de las piezas de impresión; relieve 1,0`.

### Task 10: Medir y fijar los ajustes de impresión

**Files:** Modify `bambu-perfil-data.js` (`BAMBU_AJUSTES`); Create `docs/superpowers/notas/2026-11-22-medicion-tiempo.md`.

- [ ] **Step 1:** Con tres diseños (el "Feliz Cumpleaños" de Polley en contorno; uno en aro; uno con figura PRO), laminar con `laminar.ps1`: **A** = `antes.json` (geometría vieja, perfil de Polley); **B** = geometría nueva, perfil sin cambios; **C** = B + `layer_height` y `initial_layer_print_height` = `0.25` (divide exacto 1,0 mm de color y 3 mm de placa); **D** = C + `flush_into_infill` = `1`.
- [ ] **Step 2:** Tabla en la nota: minutos, gramos, gramos de purga y cambios de filamento de A, B, C, D por diseño. Sin estimaciones: solo lo que devolvió el programa.
- [ ] **Step 3:** Regla de decisión: un ajuste entra en `BAMBU_AJUSTES` solo si baja el tiempo al menos 5 % en los tres diseños y el archivo abre en el programa sin pedir confirmación. Si ninguno cumple, `BAMBU_AJUSTES` queda vacío y se dice.
- [ ] **Step 4:** Enviar la tabla a Polley (minutos antes / después) y el archivo C o D para que lo abra; la capa de 0,25 cambia el acabado y la decide él.
- [ ] **Step 5:** Commit `feat: ajustes de impresión medidos` (o `docs: medición, sin ajustes` si no entró ninguno).

### Task 11: Publicar la entrega 2

- [ ] Igual que la Tarea 7 (`toppers-v18`, `app.js?v=35`, `modelos-data.js?v=3`), con la confirmación de Polley sobre la tabla y el archivo.

---

# ENTREGA 3 — Pie delantero

### Task 12: Zócalo, pies en rampa y estabilidad

**Files:** Modify `apoyos.js`, `app.js` (`construir`, `abrirExportar`), `index.html` (opción `pie`: "Pie delantero (mesa)"); Test `pruebas/t-pie.mjs`.

**Interfaces — Produces:**
- `zocalo(plateShapes: THREE.Shape[], alto: number) → { shape: THREE.Shape, yBase: number, xlo: number, xhi: number }`: rectángulo de `x ∈ ±0.36·ancho` de la silueta, de `yBase = ymin - alto + 2` a `ymin + 4` (se monta 4 mm sobre la silueta para quedar unido). Se suma a la placa antes del borde.
- `piesDelanteros(z: { yBase, xlo, xhi }, grosor: number) → THREE.BufferGeometry`: dos cuñas de 12 mm de ancho centradas en `xlo + 6` y `xhi - 6`; sección triangular con vértices `(yBase, grosor)`, `(yBase + 14, grosor)`, `(yBase, grosor + 14)` (rampa de 45°). Con `apoyo = "pie"`: `zocalo(…, 16)`; los pies van como `extra` de una pieza `{ rol: "apoyo", nombre: "Pies", color: c1 }`.
- `estabilidadMesa(piezas: Pieza[], apoyo: "pie"|"pata", datos) → { adelante: number, atras: number }`: grados que hay que inclinar el topper para que el centro de masa salga de la huella, hacia cada lado (masa = volumen de prismas y `extra`).
- Junto a la opción, texto fijo: `Aguanta bien hacia adelante; hacia atrás, poco. Para mesas, no para tortas.`

- [ ] **Step 1: Test** `t-pie.mjs`: para las 5 formas: `comprobarUniones().ok`; la malla de los pies es cerrada; ninguna cara tiene la normal con componente z menor que `-cos(45°) - 0.001` (sin voladizos de más de 45°) y ninguna cara queda por debajo de z = 0; el recuadro de texto, figura y adorno no se cruza con los pies; `estabilidadMesa(...).adelante ≥ 10`; el valor `atras` se muestra en el resumen de exportar ("aguanta N° hacia atrás"); el 3MF tiene la parte "Pies" con el mismo `extruder` que la placa; las huellas de la línea base (con palitos) no cambian.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5 (programa real):** `laminar.ps1` de un diseño con pie → `soportes:false`, `ok:true`.
- [ ] **Step 6:** Commit `feat: pie delantero en rampa para mesa`.

### Task 13: Publicar la entrega 3

- [ ] Igual que la Tarea 7 (`toppers-v19`, `app.js?v=36`). Se le dice a Polley el valor medido de `atras` y se le pide imprimir un topper con pie antes de ofrecerlo; lo que no se puede saber sin impresora (si se cae con un roce) se le dice así.

---

# ENTREGA 4 — Pata trasera a 45°

### Task 14: Pata, frente liso y pieza boca abajo

**Files:** Modify `apoyos.js`, `app.js` (`construir`, `refrescar`, `partesParaExportar`, `abrirExportar`), `index.html` (opción `pata`: "Pata trasera (mesa)"); Test `pruebas/t-pata.mjs`.

**Interfaces — Produces:**
- Con `apoyo = "pata"`: `zocalo(…, 5)`; **frente liso**: todos los sólidos que no son placa llevan `z0 = 0`, `z1 = grosor` (la regla de color deja el color incrustado 1 mm al ras); `#relieve` se muestra desactivado con la nota `Con pata el frente es liso`.
- `pataTrasera(z: { yBase }, altoPlaca: number, grosor: number) → { geo: THREE.BufferGeometry, anclaje: { x0, x1, y0, y1 }, largo: number }`: tabla de 14 mm de ancho y 3 mm de espesor, centrada en x = 0, que sale de la cara de atrás (z = 0) a 45° hacia abajo. Altura de unión `d = clamp(0.5·altoPlaca, 25, 60)` sobre `yBase`; largo `s = √2·d·cos12° / (cos12° + sin12°)` (≈ 1,166·d): parado, el topper queda inclinado 12° hacia atrás apoyado en el canto inferior y en la punta de la pata. La punta se corta paralela a la placa.
- `pataDisponible(plateShapes, anclaje) → boolean`: verdadero si el rectángulo de `anclaje` está cubierto por la silueta al menos en un 90 %. Si es falso: la opción se desmarca sola, vuelve a Palitos y `#apoyoMsg` = `Este diseño no tiene dónde unir la pata. Usa palitos o pie delantero.`
- `partesParaExportar()` con pata: todas las mallas giradas 180° alrededor del eje vertical de la placa (`x → -x`, `z → grosor - z`; es un giro, no un espejo: el texto se sigue leyendo de frente) para que el frente quede en z = 0. El resumen dice `Se imprime boca abajo`.
- Vista 3D con pata: el grupo se muestra parado (inclinado 12°) con la pata.

- [ ] **Step 1: Test** `t-pata.mjs`: para contorno, óvalo y rectángulo: `pataDisponible` verdadero, una sola pieza, malla de la pata cerrada; en la orientación de impresión ninguna cara tiene normal con z menor que `-cos(45°) - 0.001` y z mínima = 0; todos los vértices de las piezas de color tienen z ≤ 1,0 en la orientación de impresión (color incrustado 1 mm desde la cama); el determinante de la transformación de exportar es +1; `estabilidadMesa(...,"pata")`: `adelante ≥ 8` y `atras ≥ 15`; aro con texto corto → `pataDisponible` falso, aviso visible y `#apoyo` = `palitos`; "solo letras": si `pataDisponible` es verdadero sale en una sola pieza, y si es falso aparece el aviso (nunca una pata sin unir); al cambiar de pata a palitos, `#relieve` vuelve a estar activo y la huella coincide con la línea base.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS y todas las demás pruebas → PASS.
- [ ] **Step 5 (programa real):** `laminar.ps1` de un diseño con pata → `soportes:false`, `ok:true`, filamentos = colores.
- [ ] **Step 6:** Commit `feat: pata trasera a 45°, se imprime boca abajo`.

### Task 15: Publicar la entrega 4

- [ ] Igual que la Tarea 7 (`toppers-v20`, `app.js?v=37`). Se le pide a Polley una impresión real con pata y se le dice lo que no se pudo comprobar sin impresora: adherencia de la pata a 45° y acabado del frente contra la placa texturizada.
