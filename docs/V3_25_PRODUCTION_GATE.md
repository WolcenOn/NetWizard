# NetWizard v3.25 · Puerta de producción

Esta versión introduce una validación final agregada para acercar NetWizard a un uso más seguro en despliegues reales.

## Nuevo módulo

```text
js/netwizard-production-gate.js
```

Expone:

```js
NetWizardProductionGate.runProductionGate(project, options)
NetWizardProductionGate.summarizeGate(report, options)
NetWizardProductionGate.summarizeCounts(issues)
```

## Qué valida

La puerta agrega señales de:

- Schema/importación.
- Auditoría física L1.
- Switching/L2.
- Routing/L3 y tránsito.
- Direccionamiento IP.
- DHCP avanzado.
- Políticas firewall/ACL.
- Cableado y longitudes.
- PoE.
- Riesgo broadcast.

## Modo producción

En modo producción estricto, varios avisos pasan a ser bloqueantes si afectan a seguridad o viabilidad del despliegue: IP/DHCP, L1/L2/L3, PoE, cableado, políticas críticas y schema.

La exportación de configuraciones usa ahora esta puerta si está disponible. Si el proyecto queda `blocked`, no se generan configuraciones en modo producción.

## Estados

- `ready`: sin errores ni avisos relevantes.
- `review`: sin bloqueos, pero hay avisos que revisar.
- `blocked`: hay errores o bloqueos y no debe exportarse en producción.

## Prudencia

Esta puerta no sustituye una revisión humana ni pruebas de laboratorio. Es una barrera de calidad para evitar exportar diseños claramente incompletos o inconsistentes.
