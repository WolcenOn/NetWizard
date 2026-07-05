# NetWizard v3.5 · Preflight prudente antes de VLSM

Esta versión aplica cambios conservadores sobre v3.4 para reducir el riesgo de romper proyectos existentes.

## Cambios

- Añadido `collectAddressingIssues(project)` en `js/netwizard-vlsm-physical-planner.js`.
- Añadido `preflightProject(project)`, que combina auditoría física y auditoría de direccionamiento.
- La previsualización VLSM muestra también problemas actuales de direccionamiento.
- La aplicación VLSM se bloquea si hay errores físicos de capa 1.
- Si hay errores de direccionamiento previos, solo permite aplicar cuando el modo es `Todos los hosts de VLAN`, porque ese modo reasigna las IPs afectadas.
- Antes de aplicar VLSM desde la UI, se simula el resultado y se bloquea si todavía quedarían errores de direccionamiento.
- Si la simulación es válida, se guarda una copia del proyecto anterior en `localStorage['nwp_pre_vlsm_backup']`.
- `applyVlsmPlan` preserva el `id` de una subnet existente cuando actualiza la VLAN, reduciendo riesgo de romper referencias internas.

## Auditoría de direccionamiento

Detecta:

- Subnets inválidas.
- Subnets solapadas.
- Gateway inválido, fuera de rango o reservado.
- IP estática inválida.
- IP duplicada entre hosts.
- Host con IP fuera de la subnet de su VLAN.
- Host usando dirección de red, broadcast o gateway.
- Host con IP en VLAN sin subnet.

## Tests añadidos

- Detección de IP duplicada, host fuera de subnet y choque con gateway.
- Conservación del `id` de subnet existente al aplicar VLSM.

## Alcance

No introduce todavía Playwright ni cambia la arquitectura de UI. Es una capa de seguridad previa antes de seguir con mejoras más invasivas.
