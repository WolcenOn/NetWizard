# NetWizard v3.18 · Diff/preview para políticas por intención

Esta versión añade una capa de seguridad antes de aplicar reglas firewall/ACL generadas desde la intención por VLAN.

## Cambios

- Nuevo cálculo de diferencias antes de aplicar políticas:
  - reglas a añadir;
  - reglas generadas que cambiarían;
  - reglas generadas obsoletas que se retirarían;
  - reglas que quedarían igual;
  - total final estimado.
- Nueva opción en la UI: **Reemplazar reglas generadas obsoletas**.
- Nuevo botón **Ver diff** en la tarjeta de políticas desde intención.
- Si el diff implica retirar reglas generadas, se pide confirmación antes de aplicar.
- En modo producción se bloquea la aplicación si la auditoría de políticas devuelve errores bloqueantes.
- La aplicación sigue creando snapshot antes de modificar reglas.

## API nueva

`NetWizardPolicyUtils` expone:

- `computePolicyApplyDiff(project, options)`
- `summarizePolicyApplyDiff(diff)`

Esto permite probar y mostrar cambios sin modificar el proyecto.

## Alcance prudente

El diff solo cubre reglas gestionadas por el generador de intención. Las reglas manuales se conservan y no se modifican automáticamente.
