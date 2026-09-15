# Paquete de despliegue 3.50

NetWizard puede exportar un ZIP autocontenido para revisión y despliegue controlado. Esta exportación no depende del modo visual seleccionado: siempre ejecuta la puerta de producción con `productionMode: true` y `strict: true`.

## Política de salida

- Un error o incidencia bloqueante impide crear el ZIP.
- Los avisos permiten exportar, pero quedan registrados en el informe y el checklist.
- Una configuración vacía, no soportada o que lanza una excepción también bloquea el paquete.
- La generación usa el registro y las etapas activas de `NetWizardConfigPipeline`.
- Se aplican límites defensivos de 1.000 dispositivos, 16 MiB por archivo y 128 MiB de payload total.

## Contenido

```text
manifest.json
README.md
project/netwizard-project.json
configs/<orden>-<equipo>-<id>-<vendor>.<extensión>
reports/production-gate.json
reports/production-checklist.md
reports/inventory.csv
reports/connectivity-matrix.csv
reports/documentation.md
deployment/plan.json
deployment/runbook.md
deployment/rollback-checklist.md
```

`manifest.json` identifica la versión de schema, el estado de producción y cada archivo de payload mediante ruta, tamaño y CRC32. El ZIP usa almacenamiento sin compresión para mantener una implementación estática, auditable y sin dependencias remotas; el CRC32 del propio formato permite detectar corrupción de cada entrada.

El paquete debe tratarse como información sensible porque puede contener direccionamiento, nombres internos y configuraciones de infraestructura.

La secuencia y reversión se documentan en `docs/V3_50_DEPLOYMENT_RUNBOOK.md`.
