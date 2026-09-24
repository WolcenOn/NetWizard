# Modularización V5

## Objetivo

La vista V5 se separa progresivamente de `js/netwizard.js` mediante contratos pequeños, testeables y con responsabilidades únicas. Las mejoras nuevas deben ampliar el módulo propietario de cada responsabilidad, no volver a crecer el monolito.

## Capas actuales

### `netwizard-v5-core.js`

Modelo puro de estado, filtros, jerarquía, aliases y geometría.

### `netwizard-v5-renderer.js`

Primitivas de canvas para enlaces, nodos, colores, labels y markers.

### `netwizard-v5-interaction.js`

Matemáticas puras de hit-testing, resize, drag, pan y zoom.

### `netwizard-v5-scene.js`

Orquesta el frame completo: fondo, ubicaciones, cableado base, nodos y enlaces seleccionados.

### `netwizard-v5-drag-controller.js`

Mantiene la sesión pointer/drag y delega las mutaciones de dominio mediante callbacks.

### `netwizard-v5-location-transactions.js`

Planifica creación, edición y eliminación de ubicaciones físicas/visuales antes de tocar el proyecto.

Invariantes:

- valida nombres duplicados;
- valida padres inexistentes y ciclos;
- renombra referencias de equipos, hosts, racks y tomas;
- al eliminar, recoloca hijos y referencias al padre válido;
- mantiene sincronizadas ubicación física y ubicación V5;
- no modifica el proyecto durante la fase de planificación;
- `commit()` aplica todas las ramas afectadas y restaura el estado previo si la asignación falla.

### `netwizard-v5-commands.js`

Frontera de mutación para acciones V5. Además de dispositivos, hosts y puertos, las altas/bajas físicas entran ahora por las transacciones de ubicación.

No conoce DOM, canvas, `save()` ni `refresh()`.

### `netwizard-v5-panel.js`

Presentación DOM del panel lateral. Usa APIs DOM seguras y delega las acciones; no modifica directamente el proyecto.

### `netwizard-v5-controls.js`

Controla:

- toolbar V5;
- filtros;
- fullscreen nativo/fallback;
- Escape;
- resize de ventana;
- sincronización del botón de fullscreen.

Los listeners globales correspondientes ya no viven en `netwizard.js`.

### `netwizard-v5-bridge.js`

Expone `window.NetWizardV5` como contrato estable para extensiones, incluyendo core, renderer, interaction, scene, drag, commands, panel, transacciones de ubicación y controls.

### `netwizard.js`

Queda como adaptador legacy para:

- integración con el estado global;
- persistencia y refresh;
- sincronización con pantallas históricas;
- helpers antiguos todavía consumidos por módulos existentes.

Se han retirado los wrappers V5 de edición que solo reenviaban a commands y la implementación legacy de fullscreen/filtros globales.

## Reglas de evolución

1. Estado/geometría pura → `netwizard-v5-core.js`.
2. Dibujo → `netwizard-v5-renderer.js`.
3. Matemática de interacción → `netwizard-v5-interaction.js`.
4. Composición del frame → `netwizard-v5-scene.js`.
5. Pointer/drag → `netwizard-v5-drag-controller.js`.
6. Mutación de edición → `netwizard-v5-commands.js`.
7. Ubicaciones físicas/visuales acopladas → `netwizard-v5-location-transactions.js`.
8. DOM del panel → `netwizard-v5-panel.js`.
9. Toolbar/fullscreen/filtros → `netwizard-v5-controls.js`.
10. Toda nueva mutación acoplada debe validarse antes del commit y tener tests de rollback/referencias.
11. No introducir `innerHTML` con datos de proyecto.

## Estado del Bloque D

La separación estructural principal de V5 queda completada: core, render, interacción, scene, drag, panel, commands, transacciones y controls tienen propietarios independientes.

La deuda restante es incremental:

- reducir adapters de sincronización `physicalLocations ↔ visual.locs`;
- retirar globals legacy solo cuando no existan consumidores;
- separar adaptadores por dominio cuando una mejora futura necesite tocarlos;
- mantener compatibilidad de importación y schema 3.50.
