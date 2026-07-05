# NetWizard v3.1 · State API + IoT state integration

## Cambios principales

1. Se añade `window.NetWizardState` como API pública y estable para leer y actualizar el proyecto principal.
   - `getSnapshot()` devuelve una copia profunda del proyecto.
   - `updateProject(patchOrUpdater, options)` actualiza campos del proyecto y persiste en `localStorage`.
   - `replaceProject(project, options)` sustituye el proyecto completo con defaults seguros.
   - `save(options)` persiste el estado actual.

2. La capa IoT deja de depender únicamente de `localStorage['nw_iot_embedded_v1']`.
   - El estado IoT vive ahora dentro de `S.iot` y por tanto viaja en la exportación JSON principal.
   - Se mantiene escritura en `nw_iot_embedded_v1` por compatibilidad hacia atrás.
   - Si existe estado IoT antiguo y el proyecto aún no contiene `iot`, se migra automáticamente.

3. El bridge y el layout manager usan la API pública cuando está disponible.
   - `NetWizardBridge.getProjectSnapshot()` lee desde `NetWizardState`.
   - `netwizard-v5-layout-manager.js` ya no depende de `window.S` para leer dispositivos, puertos o enlaces.

4. El grafo unificado del bridge ahora incluye nodos IoT embebidos.
   - Infraestructura IoT: `kind: 'iot_access'`.
   - Dispositivos IoT: `kind: 'iot_device'`.
   - Enlaces IoT hacia gateway/AP/puerto/dispositivo padre cuando hay datos suficientes.

## Compatibilidad

- Los proyectos antiguos sin `iot` siguen cargando.
- Los datos IoT antiguos en `nw_iot_embedded_v1` se conservan y se copian al proyecto principal.
- La exportación JSON principal incluye ahora la sección `iot`.
- La importación JSON acepta tanto el proyecto plano como un payload con `{ project: ... }`.

## Riesgos conocidos

- La aplicación sigue siendo un conjunto de scripts clásicos, no módulos ES.
- `window.S` se mantiene solo como fallback indirecto en algunos módulos; las nuevas integraciones deben usar `window.NetWizardState`.
- Quedan pendientes pruebas E2E de navegador para cubrir export/import y flujos visuales completos.
