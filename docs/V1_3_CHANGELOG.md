# NetWizard safe refactor v1.3 - Bridge UI

## Objetivo

Añadir una interfaz visible y segura para probar el bridge NetWizard → IoTWizard sin tocar la lógica principal de NetWizard.

## Cambios

- Nuevo archivo `js/netwizard-bridge-ui.js`.
- Nuevos botones en `Configuración & Export`:
  - `🌉 Vista IoT-ready`: genera una vista JSON del grafo común en `jsonBox`.
  - `⬇ Grafo unificado`: descarga `snapshot + graph` en JSON y lo guarda en `localStorage` bajo la clave del bridge.
- Nuevo estado visual `#nwBridgeStatus`.
- No se modifica `js/netwizard.js`.
- No se sustituyen los mapas actuales.
- No se cambia la importación/exportación original.

## Pruebas recomendadas

1. Abrir NetWizard con servidor local.
2. Cargar o crear un proyecto con dispositivos, VLANs, puertos, hosts y enlaces.
3. Ir a `Configuración & Export`.
4. Pulsar `🌉 Vista IoT-ready`.
5. Comprobar que `jsonBox` muestra un JSON con `graph.nodes`, `graph.links` y `graph.segments`.
6. Pulsar `⬇ Grafo unificado`.
7. Comprobar que se descarga un JSON.
8. Confirmar que las funciones originales de export/import siguen funcionando.
