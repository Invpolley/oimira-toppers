# Medición de tiempo de impresión — 23-11-2026

Laminado con el Bambu Studio real de Polley (02.09.01.70, H2D 0.4, perfil 0.20mm Standard, PLA Basic), en modo comandos. Tres toppers de muestra (`pruebas/exportar-muestras.mjs`). Datos completos en `pruebas/bambu/medicion.json`. Nada es estimado: son los números que devolvió el programa.

- **A** = como estaba antes: geometría anterior, relieve 1,2 mm, perfil de Polley.
- **B12** = regla de color de 1 mm, relieve 1,2 mm.
- **B** = regla de color de 1 mm, relieve 1,0 mm (nuevo valor por defecto).
- **C** = B + capa de 0,25 mm (también la primera).
- **D** = C + "purgar en el relleno".

## Tiempo (minutos)

| Muestra | A | B12 | B | C | D | C contra A |
|---|---|---|---|---|---|---|
| Aro (2 colores) | 50,6 | 42,6 | 41,8 | 37,4 | 37,4 | **−26 %** |
| Contorno "Mis 15" con borde (4 colores) | 101,4 | 99,3 | 95,5 | 87,9 | 87,9 | **−13 %** |
| Figura PRO en capas (7–8 colores) | 80,3 | 96,1 | 97,1 | 85,8 | 85,6 | **+7 %** |

## Purga y cambios de filamento

| Muestra | Purga A (g) | Purga C (g) | Cambios A | Cambios C |
|---|---|---|---|---|
| Aro | 1,44 | 0,57 | 0 | 0 |
| Contorno | 4,50 | 3,35 | 7 | 5 |
| Figura PRO | 5,33 | 8,57 | 9 | 13 |

## Qué se decidió y por qué

- **Capa de 0,25 mm: entra.** Baja el tiempo 10,5 % (aro), 7,9 % (contorno) y 11,7 % (PRO) respecto de B: más del 5 % en las tres. Divide exacto 1 mm de color (4 capas) y 3 mm de placa (12 capas). Va en `BAMBU_AJUSTES` y se declara en `different_settings_to_system`.
- **Purgar en el relleno: no entra.** 0 %, 0 % y 0,2 %.
- En ninguna variante nueva Bambu Studio reparó mallas (`mesh_stat` en cero) ni usó soportes.

## Lo que hay que saber

- **Las figuras PRO en capas tardan más que antes** (+7 % con capa 0,25; +21 % con capa 0,20). Es consecuencia directa de la regla "color de por lo menos 1 mm": antes cada capa de color de la figura medía 0,45 mm; ahora cada color visible baja 1 mm, así que hay más capas de impresión con varios colores a la vez (cambios de filamento: de 9 a 13; purga: de 5,3 g a 8,6 g).
- La medida A de la figura PRO no era una impresión válida: Bambu Studio avisaba de "zonas flotantes" (capas de la figura en el aire). Con la geometría nueva ese aviso desapareció.
- **No comprobado:** que la ventana de Bambu Studio muestre la capa de 0,25 al abrir el proyecto (por comandos sí la respeta y la conserva al guardar). Lo confirma Polley al abrir un archivo.
- La purga usa la fórmula descrita en el PR 21 de bekuto3d; falta contrastarla con un proyecto recalculado por el Bambu Studio de Polley.

## Base encajable (24-11-2026)

Laminado con el Bambu Studio real (H2D, capa 0,25, relieve 1,0). Incluye topper + base en la misma cama.

| Muestra | Palitos | Solapa trasera | Base encajable | Gramos (base encajable) |
|---|---|---|---|---|
| Aro 140×156 | 2242 s | 3780 s | 3785 s | 33,2 |
| Contorno 148×197 (4 colores) | 5274 s | 7264 s | 7203 s | 73,2 |
| Figura PRO 138×162 (8 colores) | 5146 s | 6903 s | 6754 s | 56,3 |
| Rectángulo 140×86 | — | — | 3655 s | 45,2 |
| Rosa clásica óvalo 140×220 | — | — | 7309 s | 96,0 |
| Mariposas solo letras 152×204 | — | — | 6494 s | 64,9 |

- En las seis: sin soportes, sin avisos, 0 mallas reparadas.
- Tarda casi lo mismo que la solapa, pero el topper sale boca arriba, con relieve, y nada mide más de 14 mm de alto en la cama.
- Una primera forma de la base (barra de 4 mm a todo el ancho) tardaba 15 min más y gastaba 14 g más: se descartó.
- **No comprobado:** el ajuste real del encaje (depende de la impresora y el filamento). Lo confirma Polley imprimiendo; para eso está el campo de holgura.
