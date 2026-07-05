# NetWizard v2.3 · V5 Layout & Fullscreen Fix

Cambios incluidos:

- Las ubicaciones V5 ahora ajustan su área visible al contenido real: equipos y hosts enlazados a switches/equipos dentro de esa ubicación.
- Los hosts se consideran dentro de la ubicación del equipo/puerto al que están conectados, lo que prepara mejor la futura autoasignación por ubicación.
- El tooltip de los puntos de enlace se inserta dentro del contenedor V5 para seguir visible en pantalla completa.
- Se corrige el escalado de tarjetas/rectángulos en zoom lejano: radios, bordes y texto se escalan de forma consistente.
- En zoom bajo, los nodos reducen detalle para evitar deformaciones visuales y sobrecarga de etiquetas.

Notas técnicas:

- Se añadió `hostEffectiveVisualLoc()` para resolver la ubicación real del host priorizando la ubicación del dispositivo conectado.
- `visualLocBounds()` ahora expande el área si los nodos internos quedan fuera del mínimo calculado.
- `drawRound()` limita el radio máximo para evitar deformaciones cuando el zoom es bajo.
- El tooltip `v5LinkTooltip` se adjunta a `#v5Layout`, no a `document.body`, para que sea visible cuando `#v5Layout` está en fullscreen.

Pruebas recomendadas:

1. Crear dos ubicaciones.
2. Colocar un switch en una ubicación.
3. Crear varios hosts y enlazarlos a puertos del switch.
4. Comprobar que el área de ubicación crece si los hosts no caben.
5. Alejar zoom y comprobar que los rectángulos no se deforman.
6. Entrar en pantalla completa y pasar el ratón sobre los puntos de enlace.
