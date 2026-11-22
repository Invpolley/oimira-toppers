# OiMira Toppers — palitos a elegir, apoyos de mesa, proyecto Bambu y ahorro de tiempo

Fecha: 22-11-2026 · App: `oimira-toppers` (GitHub Pages, `invpolley.github.io/oimira-toppers`) · Versión de partida: v2026-11-11.1

## 1. Para qué

Polley vende toppers multicolor impresos en una Bambu Lab H2D con AMS. Hoy la app decide sola cuántos palitos poner, solo sabe hacer toppers para clavar en la torta, y el archivo que descarga abre en Bambu Studio con un solo filamento: hay que reasignar los colores a mano en cada pedido. Además el archivo no ayuda a imprimir rápido. Quiere descargar y mandar a imprimir sin retoques.

## 2. Metas

1. **Palitos a elegir**: el usuario decide cuántos palitos lleva el topper (1 a 4) y su largo.
2. **Apoyos de mesa** (topper que se para sobre una superficie, sin palitos), los dos de una sola pieza y sin soportes de impresión:
   - **Pata trasera a 45°** (tipo portarretrato, 3 puntos de apoyo).
   - **Pie delantero en rampa a 45°**.
3. **Proyecto Bambu**: el 3MF abre en Bambu Studio como UNA pieza con sus partes, cada parte ya asignada a su filamento, y el proyecto trae la lista de filamentos con sus colores (para que el AMS pida todos).
4. **Ahorro de tiempo**: lo que se descarga ya viene pensado para imprimir rápido, y el ahorro se mide con Bambu Studio real (minutos antes / después), no se estima.

### No son metas
- Cambiar el editor (texto, figuras, adornos, colecciones, asistente "Guíame").
- Laminar dentro de la app o mandar a la impresora desde la app.
- Perfiles para otras impresoras: se optimiza para la H2D (decisión previa de Polley). En otra impresora el archivo debe abrir igual, con colores, aunque sin los ajustes de H2D.

### Sería un fracaso aunque "funcione"
- Que un topper de mesa se caiga solo, o necesite soportes para imprimirse.
- Que el color tenga menos de 1 mm de profundidad (pedido expreso de Polley).
- Que los bocetos ya guardados de clientes se abran distinto a como se guardaron.
- Que el archivo abra bien en mis pruebas pero no en el Bambu Studio de Polley: hay que comprobar con el programa real.

## 3. Lo que hay hoy (leído del código publicado)

- Todo el topper es una silueta 2D extruida: placa (`grosor`, 3 mm) y encima, en relieve (`relieve`, 1,2 mm), texto, figura, adorno y borde, cada uno de un color. Formas de placa: contorno, solo letras, aro, óvalo, rectángulo.
- Palitos: casilla "Palitos integrados" + largo. La cantidad la fija el código: en "contorno" y "solo letras", 1 si la base es angosta y 2 si no; en aro, óvalo y rectángulo, siempre 2. Son parte de la placa.
- En "aro" y "solo letras" el texto, la figura y el adorno hoy atraviesan TODO el espesor en su color (cambio de filamento en todas las capas). Los motivos PRO son capas apiladas de 0,45 mm, cada una de un color.
- Los 12 modelos de colección traen `relieve: "1.2"` en sus campos.
- `construir()` devuelve geometrías 3D por pieza y `d2` (las mismas piezas en 2D) para miniaturas y para "Comprobar uniones".
- Exportación: `construir3mf()` escribe un 3MF genérico (un `<object>` suelto por color, `basematerials`, y un `model_settings.config` que Bambu no reconoce porque el archivo no se declara proyecto de Bambu ni trae lista de filamentos). También exporta un ZIP de STL por color.
- Los diseños se guardan (borrador local, bocetos de clientes en Supabase, modelos de colección) como `{campos:{…}, palitos:true|false, …}`.

## 4. Caminos considerados

**Exportación**
- A. Proyecto Bambu nativo: una pieza con partes + filamento por parte + lista de filamentos y colores. **Elegido**: es lo único que deja el archivo listo sin tocar nada.
- B. Seguir con 3MF genérico y dejar que Bambu "importe colores". Descartado: en las versiones recientes Bambu pinta superficies en vez de asignar filamentos, muestra un diálogo cada vez y el resultado cambia entre versiones.
- C. Solo STL por color. Queda como salida de respaldo (ya existe), no como camino principal.

**Ahorro de tiempo**
- A. Color solo en las capas de arriba del relieve. Con el mínimo de 1 mm que pidió Polley casi no ahorra sobre un relieve de 1,2 mm; se aplica solo cuando el relieve es más alto que la profundidad de color.
- B. Menos capas con color: relieve por defecto 1,0 mm y capa más gruesa. **Elegido** junto con C.
- C. Ajustes de impresión dentro del proyecto (H2D). **Elegido**, sujeto a que Bambu Studio los respete; si no, se entregan solo geometría, partes y filamentos.
- D. Imprimir boca abajo con colores incrustados: se usa donde hace falta (pata trasera), no como modo general, porque quita el relieve.

**Apoyos de mesa**: Polley eligió tener los dos (pata trasera y pie delantero). La base aparte con ranura quedó fuera.

## 5. Diseño

### 5.1 Selector de apoyo
En "Placa y medidas", en lugar de la casilla "Palitos integrados":

```
Apoyo   [ Palitos ▾ ]      opciones: Palitos · Pata trasera (mesa) · Pie delantero (mesa) · Sin apoyo
Cantidad [ Auto ▾ ]  Largo [ 45 ] mm        ← solo con Palitos (Auto, 1, 2, 3, 4)
```

- **Auto** hace exactamente lo de hoy (1 o 2 según el ancho). Es el valor por defecto, así los diseños guardados y los modelos de colección no cambian.
- Con 1–4, los palitos se reparten parejos a lo ancho de la base y cada uno nace donde la silueta existe (en "contorno" y "solo letras" se busca el borde inferior real en esa x). Si en una posición no hay de dónde agarrarse, se corre a la más cercana que sí; si no caben tantos, se ponen los que caben y se avisa.
- Compatibilidad: un diseño guardado con `palitos:true` equivale a Apoyo = Palitos, Cantidad = Auto; `palitos:false` equivale a Sin apoyo. El campo viejo se sigue escribiendo para que una versión anterior de la app abra los bocetos nuevos sin romperse.

### 5.2 Pata trasera a 45° (se imprime boca abajo)
- Una pata sale de la cara de atrás, centrada, a 45° respecto de la placa y apuntando hacia abajo. Parado, el topper se apoya en el borde inferior (2 puntos) y en la punta de la pata (1 punto), inclinado unos 12° hacia atrás.
- Para que el borde inferior apoye en dos puntos y no en una curva, la silueta gana un zócalo recto abajo.
- La pata se une donde hay material; si la forma no deja un punto de unión sólido cerca del centro (por ejemplo "aro" o "solo letras" muy caladas), la app lo dice y no ofrece la pata para ese diseño.
- Se imprime con el frente contra la cama. Por eso en este apoyo el frente es **liso**: texto, figura, adorno y borde van incrustados al ras, con **1 mm de profundidad de color**, y la placa por detrás es de un solo color. En la cama la pata sube a 45°, que es lo que permite imprimirla sin soportes.
- La vista 3D muestra el topper parado con su pata, y el resumen de exportar dice "se imprime boca abajo".

### 5.3 Pie delantero en rampa (se imprime boca arriba, con relieve)
- Dos pies en el borde inferior, hacia el frente, cada uno una cuña con rampa de 45°. En la cama la cuña descansa entera, sin voladizos.
- Parado queda vertical. Aguanta bien hacia adelante; hacia atrás el margen es chico (limitación física ya conversada con Polley). La app lo indica junto a la opción.
- La placa gana una franja inferior para que los pies no tapen el diseño.

### 5.4 Profundidad de color (regla única para todo lo que se exporta)
- Nuevo valor "Profundidad del color" = 1,0 mm (mínimo 1,0; no se puede bajar).
- **Regla**: mirando el topper de frente, cada punto tiene un color visible. Ese color ocupa el milímetro de arriba de ese punto; todo lo que queda debajo se imprime del color de la placa. La forma y las alturas no cambian: solo cambia de qué color es el material que no se ve de frente.
- Consecuencias de aplicar la misma regla en todos lados (decisión de Claude, coherente con lo que Polley eligió: "color solo arriba, mínimo 1 mm"):
  - Relieve más alto que 1 mm: la parte baja del relieve sale del color de la placa.
  - Relieve más bajo que 1 mm (se permite desde 0,6): el color se hunde en la placa hasta completar 1 mm.
  - "Aro" y "solo letras": las letras dejan de ser de color en todo su espesor; de frente se ven igual, pero de costado y por detrás se ve el color de la placa. Es donde más tiempo se ahorra.
  - Motivos PRO: se ven igual (mismos escalones), pero cada color visible baja 1 mm en vez de 0,45.
  - Pata trasera: la incrustación del frente mide esa misma profundidad.
- Relieve por defecto pasa de 1,2 a 1,0 mm, también en los 12 modelos de colección (es de donde parten casi todos los pedidos). Los diseños ya guardados conservan su forma y sus alturas; la regla de color se les aplica al exportar.

### 5.5 Proyecto Bambu
- El 3MF se declara proyecto de Bambu Studio y contiene una sola pieza cuyas partes son: placa, texto, figura (o sus capas), adorno, borde y, si hay, pies o pata.
- Cada parte lleva su número de filamento. Las partes que comparten color comparten filamento (hoy cada parte ocupa uno aunque el color se repita).
- La lista de filamentos del proyecto son **solo los colores que usa el diseño**, sin repetir, en este orden: placa primero y luego los demás según aparecen (texto, figura, adorno, borde). Todos PLA.
- Un color que no está en la paleta de filamentos de la tienda se exporta tal cual; el resumen de exportar lo marca ("no está en tus filamentos") y Bambu Studio lo empareja con el carrete más parecido al imprimir. No se bloquea la descarga ni se limita la cantidad: el resumen dice cuántos filamentos pide el diseño.
- La pieza llega ya orientada y apoyada en la cama (boca abajo y espejada cuando corresponde).
- El botón de STL por color se mantiene como respaldo.

### 5.6 Ahorro de tiempo
- Ajustes dentro del proyecto pensados para estas piezas planas en la H2D: altura de capa mayor, y lo necesario para reducir purga en los cambios de color. Se parte del perfil real de Polley (ver sección 10), no de uno inventado.
- El reparto entre las dos boquillas de la H2D se deja a Bambu Studio; la app no lo fuerza.
- Medición antes de publicar, con el mismo diseño de referencia: "antes" = la geometría de hoy con los colores asignados a mano y el perfil de Polley; "después" = el archivo nuevo. Se informa el tiempo y los cambios de filamento de cada uno.

## 6. Cómo se comprueba

- Bambu Studio real (versión Linux, la misma versión que usa Polley, en el espacio de trabajo de Claude y no en su PC) abre cada 3MF generado: una pieza, N partes, N filamentos con sus colores, y lamina sin errores y sin soportes. Todavía no está comprobado que ese programa corra en el espacio de trabajo; si no corre, Polley abre los archivos de prueba y la medición de tiempo la da su Bambu Studio.
- Pruebas automáticas en navegador: cada forma de placa × cada apoyo sale en una sola pieza ("Comprobar uniones"); 1–4 palitos; los 12 modelos de colección y un boceto guardado viejo conservan la misma silueta de frente que hoy (la altura del relieve de los modelos sí cambia, de 1,2 a 1,0).
- Estabilidad de los apoyos de mesa: cálculo del centro de masa contra la huella de apoyo, y una prueba de impresión real que hace Polley (un modelo con pata y uno con pie) antes de ofrecerlo a clientes.
- Lo que no se puede comprobar sin la impresora (adherencia de la pata a 45°, acabado del frente boca abajo) se le dice a Polley tal cual.

## 7. Orden de entrega

1. Proyecto Bambu (es lo que hoy obliga a retocar cada pedido) + cantidad de palitos.
2. Profundidad de color y ahorro de tiempo, con las mediciones.
3. Pie delantero.
4. Pata trasera (la más nueva: cambia la forma de imprimir).

Cada entrega se publica por separado, con respaldo de la versión anterior.

## 8. Queda a criterio de quien construye

- Medidas exactas de pata, pies, zócalo y franja (ancho, espesor, largo), siempre que cumplan estabilidad y 45°.
- Nombres de campos nuevos y estructura interna del código.
- Qué ajustes de impresión concretos se incluyen, según lo que Bambu Studio respete al abrir el archivo.
- Textos de ayuda en pantalla (en español, breves).

## 9. Riesgos conocidos

- El formato de proyecto de Bambu no está documentado oficialmente; se deduce del programa. Puede cambiar con una versión nueva de Bambu Studio.
- Si los ajustes de H2D incluidos no coinciden con la impresora seleccionada en el Bambu Studio de Polley, el programa puede pedir confirmación al abrir.
- El pie delantero es estable hacia adelante y poco hacia atrás.

## 10. Dato que falta y solo tiene Polley

Un proyecto cualquiera guardado desde su Bambu Studio (Archivo → Guardar proyecto, un `.3mf`). De ahí salen la versión del programa, la boquilla, el tipo de PLA, la placa y el perfil con el que lamina hoy. Sirve de modelo exacto para el formato y de línea base para medir el ahorro. Sin ese archivo se puede construir igual, pero con perfiles genéricos de H2D y mayor riesgo de que Bambu Studio pida confirmaciones al abrir.
