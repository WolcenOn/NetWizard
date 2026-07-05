# Pruebas del bridge IoT-ready

## Consola

```js
NetWizardBridge.version
NetWizardBridge.getProjectSnapshot()
NetWizardBridge.makeUnifiedGraph()
NetWizardBridge.saveUnifiedSnapshot()
```

## UI

En `Configuración & Export` aparecen dos controles nuevos:

- `🌉 Vista IoT-ready`: vista rápida en `jsonBox`.
- `⬇ Grafo unificado`: descarga JSON para usarlo como contrato de integración.

## Qué debe contener el grafo

- `segments`: VLANs/subnets normalizadas.
- `nodes`: dispositivos, hosts y puertos.
- `links`: enlaces físicos, relaciones device-port y accesos host-port.

## Criterio de seguridad

La v1.3 solo lee el estado de NetWizard. No altera formularios, renderizados ni mapas.
