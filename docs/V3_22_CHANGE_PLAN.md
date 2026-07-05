# NetWizard v3.22 · Plan común de cambios

Esta versión añade una capa conservadora para revisar y aplicar automatismos desde un único punto del dashboard.

## Nuevo módulo

- `js/netwizard-change-plan.js`

Expone:

- `NetWizardChangePlan.buildPlan(project, options)`
- `NetWizardChangePlan.summarizePlan(plan)`
- `NetWizardChangePlan.applyPlan(project, options)`

## Funcionalidad

El plan común permite previsualizar y aplicar, con snapshot previo:

- VLSM.
- DHCP avanzado.
- IPs L3 de redes de tránsito.
- Políticas firewall/ACL desde intención de VLAN.

Cada bloque puede activarse o desactivarse de forma independiente. Las herramientas específicas existentes se mantienen.

## Seguridad operativa

Antes de aplicar:

1. Se calcula el proyecto simulado.
2. Se muestra un resumen por bloque.
3. Se calcula la auditoría final estimada.
4. En modo producción, puede bloquearse la aplicación si siguen existiendo errores bloqueantes.
5. Se crea snapshot local: `Antes de aplicar plan común`.

## Limitaciones

- No sustituye una revisión humana de reglas firewall.
- No corrige automáticamente todos los errores de capa 1/L2/L3.
- Las políticas siguen siendo una base inicial derivada de intención, no una política final certificada.
