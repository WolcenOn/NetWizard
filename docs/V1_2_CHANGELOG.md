# Changelog v1.2

## Añadido

- `js/netwizard-bridge.js` como capa de compatibilidad externa.
- `window.NetWizardBridge` con API de lectura para snapshot y grafo común.
- Exportación manual de snapshot unificado a JSON.
- Almacenamiento opcional del snapshot unificado en `localStorage`.
- Documentación `docs/BRIDGE_API.md`.

## No cambiado

- No se toca la lógica principal de `js/netwizard.js`.
- No se sustituye el render de topología actual.
- No se cambian los formularios, eventos ni la clave de almacenamiento original.
- No se usan módulos ES todavía.

## Riesgo

Bajo. El nuevo archivo se carga después de NetWizard y solo expone funciones nuevas.

## Prueba rápida

En consola del navegador:

```js
NetWizardBridge.version
NetWizardBridge.getProjectSnapshot()
NetWizardBridge.makeUnifiedGraph()
NetWizardBridge.saveUnifiedSnapshot()
```
