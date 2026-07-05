# Graph Viewer Notes

El visor v1.5 es deliberadamente de solo lectura. Su función es validar que el grafo normalizado generado por `NetWizardBridge` es útil para IoTWizard.

## Criterios de diseño
- No sustituye el mapa actual.
- No escribe sobre el estado `S`.
- No importa módulos ES todavía.
- Se carga después de `netwizard-bridge.js` y `netwizard-bridge-ui.js`.
- Puede eliminarse sin afectar NetWizard.

## Relación futura con IoTWizard
IoTWizard podrá consumir la misma estructura `nw-unified-graph-v1` y añadir:
- nodos `iot_device`,
- enlaces `wireless`, `lora`, `zigbee`, `thread`, `mqtt`,
- credenciales y parámetros de conexión,
- reglas sugeridas y validaciones IoT.

El siguiente paso será definir un `iotWizardToUnifiedGraph()` equivalente y después un `mergeUnifiedGraphs()`.
