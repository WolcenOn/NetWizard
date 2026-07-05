# NetWizard v3.8 · Historial local y E2E UI inicial

Esta versión continúa la aproximación prudente a producción sin reescribir el núcleo.

## Cambios

### Historial y snapshots

Se añade `js/netwizard-history.js`, que expone `window.NetWizardHistory` y guarda snapshots locales en `localStorage['nwp_history_v1']`.

Funciones públicas principales:

- `createSnapshot(label, options)`
- `listSnapshots()`
- `restoreSnapshot(id, options)`
- `deleteSnapshot(id)`
- `clearSnapshots()`

El dashboard incorpora una tarjeta “Historial y snapshots”. Se conservan los últimos 20 snapshots.

### Snapshot previo a VLSM

Antes de aplicar un plan VLSM, la aplicación ahora guarda:

- `localStorage['nwp_pre_vlsm_backup']`, para compatibilidad con v3.5.
- Un snapshot restaurable en `NetWizardHistory`.

### E2E UI inicial

Se amplía `tests/e2e/netwizard-smoke.spec.js` con un flujo que usa formularios reales para crear:

1. VLAN.
2. Dispositivo.
3. Puerto.
4. Host.
5. Snapshot.
6. Restauración de snapshot.

## Comandos

```bash
npm test
npm run check:syntax
npm run test:e2e:install
npm run test:e2e
```

## Límites conocidos

- El historial está en `localStorage`, no en una base de datos.
- No hay comparación visual tipo diff entre snapshots.
- Las pruebas E2E aún son básicas y deben crecer hasta cubrir import/export por selector de archivos, enlaces físicos y generación de configuración.
- Todavía no se considera listo para producción.
