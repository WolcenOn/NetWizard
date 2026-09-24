# Modularización V5

## Objetivo

La vista V5 se está separando progresivamente de \`js/netwizard.js\` sin reescribir el renderer de una sola vez. El objetivo es que nuevas mejoras visuales puedan apoyarse en contratos pequeños, testeables y estables.

## Capas

### \`netwizard-v5-core.js\`

Módulo puro, sin DOM, canvas ni persistencia.

Responsabilidades actuales:

- normalización del estado \`visual\`;
- filtros y visibilidad de dispositivos/hosts;
- jerarquía de ubicaciones visuales;
- asignaciones equipo/host → ubicación;
- inferencia de ubicación desde rack, ubicación física y toma;
- aliases de puertos de enlaces;
- vecinos y grafo de ubicaciones;
- geometría de nodos y transformaciones mundo/pantalla.

Puede cargarse desde Node para tests unitarios.

### \`netwizard.js\`

Sigue conteniendo temporalmente:

- renderer canvas V5;
- interacción drag/drop;
- fullscreen;
- panel de edición;
- sincronización con otras pantallas legacy.

Las funciones legacy \`vv()\`, \`vLocs()\`, \`visualNodeBounds()\`, \`v2s()\`, etc. se conservan por compatibilidad, pero delegan en \`NetWizardV5Core\` cuando la regla ya ha sido extraída.

### \`netwizard-v5-bridge.js\`

Expone \`window.NetWizardV5\`, contrato recomendado para cualquier extensión nueva.

Proporciona acceso controlado a:

- proyecto y estado visual;
- métricas;
- ubicaciones;
- geometría;
- resolución canónica de enlaces;
- redraw/panel/selección.

Las extensiones nuevas no deben depender directamente de \`vv()\`, \`vLocs()\`, \`V5S\`, \`visualNodeBounds()\` ni otras funciones internas de \`netwizard.js\` cuando exista equivalente en el bridge.

### Extensiones

\`netwizard-v5-layout-manager.js\` y \`netwizard-v5-connectivity-trace.js\` consumen el bridge estable.

## Reglas de evolución

1. Extraer primero funciones puras al core.
2. Mantener wrapper legacy durante la transición.
3. Migrar consumidores al bridge antes de eliminar un global.
4. No mover persistencia ni mutaciones de proyecto al core.
5. Toda regla nueva de aliases o geometría debe existir una sola vez.
6. Añadir test unitario al módulo afectado (`core`, `renderer` o `interaction`) y Playwright cuando el cambio sea visual.
7. No hacer una reescritura completa del canvas mientras existan contratos legacy sin cobertura.

## Próximos cortes seguros

- mover la orquestación completa del frame (`drawV5`) a un scene renderer;
- extraer el controlador de drag/drop para dejar las mutaciones como comandos explícitos;
- convertir el panel lateral V5 en módulo propio;
- retirar wrappers legacy solo cuando ningún consumidor los use.
