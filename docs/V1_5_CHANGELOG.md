# NetWizard Safe Refactor v1.5 · Unified Graph Viewer

## Objetivo
Añadir una vista visual de solo lectura del grafo unificado para acercar NetWizard a la integración definitiva con IoTWizard, sin tocar la lógica principal.

## Añadido
- `js/netwizard-graph-viewer.js`
- Visor en canvas dentro de **Configuración & Export**.
- Resumen visual de nodos de red, endpoints, candidatos IoT, puertos, VLANs y avisos.
- Click en nodos para ver detalles.
- Toggle para mostrar/ocultar puertos.
- Toggle para mostrar/ocultar enlaces host→red inferidos.

## No modificado
- `js/netwizard.js`
- Mapas V4/V5 existentes.
- Formularios.
- Export/import original.
- Guardado local original.

## Prueba recomendada
1. Cargar o crear proyecto.
2. Ir a Configuración & Export.
3. Comprobar que aparece la tarjeta “Grafo unificado”.
4. Pulsar “Actualizar grafo”.
5. Activar “Mostrar puertos”.
6. Comprobar que los candidatos IoT se ven en naranja.
7. Exportar grafo unificado y comprobar JSON.
