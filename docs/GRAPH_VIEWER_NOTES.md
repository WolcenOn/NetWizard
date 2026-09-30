# Graph Viewer Notes

## Estado

El visor `netwizard-graph-viewer.js` queda **retirado del entrypoint normal**.

Fue un prototipo de solo lectura para validar el contrato `NetWizardBridge` y demostrar que el grafo normalizado podía consumirse por una futura integración con IoTWizard. Su objetivo experimental ya se cumplió y hoy duplica información que V5 y la topología física presentan mejor.

## Decisión de producto

- V5 es la vista visual principal y editable.
- Topología física cubre cableado, puertos y enlaces.
- No se expone un tercer grafo global de auditoría en la navegación.
- `NetWizardBridge` puede mantenerse como API interna mientras siga siendo útil para IoT/compatibilidad.
- `netwizard-graph-viewer.js`, `netwizard-bridge-ui.js` y `netwizard-unified-config-map.js` se han eliminado físicamente del código ejecutable.
- `netwizard-v5-layout-manager.js` ya no contiene layouts, estado local ni listeners para la antigua Auditoría Unificada.
- `netwizard-v5-iot-extension.js` ya no intenta redibujar el mapa retirado.

La historia del experimento queda únicamente en documentación/changelog; reintroducirlo requeriría una decisión de producto nueva, no reactivar código residual.
