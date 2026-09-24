# Modularización V5

## Objetivo

La vista V5 se separa progresivamente de `js/netwizard.js` mediante contratos pequeños, testeables y con responsabilidades únicas. El objetivo no es reescribir V5 de golpe, sino impedir que nuevas mejoras vuelvan a ampliar el monolito.

## Capas actuales

### `netwizard-v5-core.js`

Modelo puro, sin DOM, canvas ni persistencia.

Responsabilidades:

- normalización del estado `visual`;
- filtros y visibilidad;
- jerarquía de ubicaciones;
- asignaciones equipo/host → ubicación;
- inferencia desde rack, ubicación física y toma;
- aliases de enlaces;
- vecinos y grafo de ubicaciones;
- geometría y transformaciones mundo/pantalla.

### `netwizard-v5-renderer.js`

Primitivas de canvas:

- enlaces de red;
- enlaces host ↔ equipo;
- nodos;
- colores/accentos;
- labels y markers.

No decide el orden del frame ni modifica proyecto.

### `netwizard-v5-interaction.js`

Matemáticas puras de interacción:

- hit-testing;
- resize handles;
- drag;
- pan;
- zoom;
- detección de markers.

### `netwizard-v5-scene.js`

Orquesta el frame completo:

1. fondo/rejilla;
2. ubicaciones;
3. cableado base;
4. nodos;
5. enlaces seleccionados.

Produce también el estado de render y los puntos interactivos usados por tooltips.

### `netwizard-v5-drag-controller.js`

Mantiene la sesión pointer/drag y coordina pointer down/move/up, pan, zoom, resize y drops. Las mutaciones de dominio se reciben mediante callbacks explícitos.

### `netwizard-v5-commands.js`

Frontera de mutación para las ediciones V5.

Centraliza actualmente:

- edición de dispositivos;
- edición de hosts;
- edición de puertos;
- cambio de puerto/equipo de un host;
- movimiento visual de equipos y hosts;
- tamaño/metadatos de ubicaciones;
- filtros;
- modo profesional;
- etiquetas compactas.

No conoce DOM, canvas, `save()` ni `refresh()`. Devuelve intención de actualización para que el adaptador la aplique.

### `netwizard-v5-panel.js`

Presentación DOM del panel lateral.

Reglas:

- usa APIs DOM seguras y `textContent`;
- no usa `innerHTML`;
- no modifica directamente el proyecto ni posiciones visuales;
- toda acción se delega al controlador/commands.

### `netwizard-v5-bridge.js`

Expone `window.NetWizardV5`, contrato recomendado para extensiones.

Publica acceso controlado a core, renderer, interaction, scene, drag controller, commands y panel, además de proyecto, geometría, ubicaciones y resolución canónica de links.

### `netwizard.js`

Permanece temporalmente como adaptador legacy para:

- integración con el estado global existente;
- persistencia/refresh;
- fullscreen;
- acciones de dominio todavía no convertidas a commands;
- compatibilidad con pantallas y helpers históricos.

Ya no debe recibir nuevas implementaciones de renderer, scene, interacción, drag ni panel.

## Reglas de evolución

1. Función pura de estado/geometría → `netwizard-v5-core.js`.
2. Primitiva de dibujo → `netwizard-v5-renderer.js`.
3. Matemática de interacción → `netwizard-v5-interaction.js`.
4. Orden/composición del frame → `netwizard-v5-scene.js`.
5. Sesión de pointer/drag → `netwizard-v5-drag-controller.js`.
6. Mutación producida por una acción V5 → `netwizard-v5-commands.js`.
7. Controles/DOM del panel → `netwizard-v5-panel.js`.
8. Mantener wrappers legacy solo mientras exista un consumidor.
9. Añadir unitarios al módulo afectado y Playwright cuando el cambio sea visual o de interacción.
10. No introducir `innerHTML` con datos de proyecto.

## Próximos cortes seguros

- mover eliminación/creación física compleja a comandos transaccionales;
- convertir fullscreen y toolbar V5 en controladores pequeños;
- eliminar wrappers legacy sin consumidores;
- dividir adaptadores V5 restantes de `netwizard.js` por dominio.
