# NetWizard v3.28 · JSON Schema externo y samples oficiales

## Objetivo

La v3.28 acerca NetWizard a una versión candidata de producción añadiendo validación formal externa y proyectos de ejemplo versionados.

## Archivos añadidos

- `schemas/netwizard-project.schema.json`
- `samples/small-office.json`
- `samples/school-network.json`
- `samples/iot-cameras.json`
- `samples/l3-transit-demo.json`

## Qué valida el schema externo

El schema valida el payload exportado:

```json
{
  "format": "netwizard-project",
  "schemaVersion": "3.28.0",
  "exportedAt": "...",
  "project": { }
}
```

Incluye validación básica para:

- Dispositivos.
- Puertos.
- VLANs e intención.
- Subnets y gateways.
- Hosts.
- Enlaces físicos y tránsito L3.
- DHCP avanzado.
- Reglas firewall.
- Estructura IoT integrada.

## Samples oficiales

Los samples sirven para:

- Probar import/export.
- Probar auditorías.
- Evitar regresiones.
- Documentar casos de uso.
- Alimentar futuras pruebas E2E.

Casos incluidos:

- `small-office.json`: oficina pequeña con usuarios/invitados/firewall/switch PoE.
- `school-network.json`: red educativa con staff, estudiantes, invitados y gestión.
- `iot-cameras.json`: red IoT/cámaras con PoE, NVR y MQTT gateway.
- `l3-transit-demo.json`: demo de enlace routed entre routers con red de tránsito.

## Tests

`npm test` valida que:

- Una exportación preparada por `NetWizardProjectSchema.prepareExport(...)` cumple el JSON Schema externo.
- Todos los samples cumplen el JSON Schema externo.
- Todos los samples pueden importarse mediante `prepareImport(...)` sin errores críticos.

## Limitaciones

Este schema externo es intencionadamente prudente. No intenta sustituir todas las auditorías de NetWizard. Valida forma, tipos y rangos básicos; las reglas profundas siguen estando en módulos especializados como L2, DHCP, PoE, broadcast, políticas y puerta de producción.
