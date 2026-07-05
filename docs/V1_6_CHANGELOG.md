# NetWizard v1.6 · Publicación para IoTWizard

## Añadido

- Nuevo script `js/netwizard-iot-publisher.js`.
- Botón visible: **📡 Publicar para IoTWizard**.
- Publicación del grafo unificado en `localStorage["netwizard_unified_graph_v1"]`.
- Mantenimiento del snapshot completo en `localStorage["netwizard_unified_project_v1"]`.
- Notificación opcional por `BroadcastChannel` en el canal `netwizard_iotwizard_bridge`.

## No modificado

- `js/netwizard.js` sigue intacto.
- No se sustituye el mapa V4/V5.
- No se altera el guardado original de NetWizard.
- No se aplican cambios automáticos desde IoTWizard.

## Prueba rápida

1. Abre NetWizard.
2. Crea o carga un proyecto.
3. Ve a **Configuración & Export**.
4. Pulsa **📡 Publicar para IoTWizard**.
5. Abre IoTWizard v2.2 en el mismo servidor/origen.
6. Pulsa **Importar NetWizard**.
