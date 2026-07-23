# Diagnósticos arquitectónicos de NetWizard 3.48.0

## Estado

Roadmap funcional completado en `feat/diagnostics-link-validation` sobre la base `chore/stabilize-3.48.0`.

La versión pública del paquete permanece en `3.48.0`. Las versiones internas de los módulos identifican el contrato técnico de cada extensión y no sustituyen a la versión de release.

## Puerta de Producción ampliada

`js/netwizard-production-gate-architecture.js` envuelve la Puerta de Producción existente y combina los informes de arquitectura, compatibilidad, inventario, resiliencia, WAN, capacidad, servicios, Wi-Fi, IPv6/VRF, simulación de fallos y drift.

Los problemas con `blocking: true` o severidad `error` establecen:

- `report.ok = false`
- `report.canExport = false`
- `report.status = "blocked"`

Los avisos no bloqueantes establecen el estado `review`.

## Bloques implementados

### 1. Capacidades, dependencias y conflictos

- Registro neutral de capacidades por dispositivo.
- Dependencias entre capacidades.
- Conflictos y límites cuantitativos.
- Diagnósticos `NW-CAP-*`.

### 2. Inventario físico e interfaces

- Chasis, módulos, slots, transceptores y propiedades avanzadas.
- Coherencia entre medios, velocidades, breakout y referencias físicas.
- Diagnósticos `NW-PHY-*` y `NW-IF-*`.

### 3. Resiliencia, stacks, MLAG y HA

- Stacks, pares MLAG, grupos HA y diversidad física.
- Validación de miembros, dominios de fallo, racks y alimentación.
- Diagnósticos `NW-RES-*`.

### 4. Circuitos WAN

- Proveedor, rol, capacidad, SLA, demarcación y recorrido físico.
- Diversidad comercial y física.
- Capacidad de respaldo.
- Diagnósticos `NW-WAN-*`.

### 5. Perfiles de tráfico y capacidad

- Tráfico medio, pico y crítico por circuito o enlace.
- Utilización, sobrecapacidad y capacidad desconocida.
- Requisitos de latencia, jitter y pérdida.
- Diagnósticos `NW-CAPACITY-*`.

### 6. Servicios internos

- DNS, DHCP, NTP, RADIUS, TACACS+, Syslog, SIEM, PKI y monitoring.
- Endpoints, redundancia, dependencias y detección de ciclos.
- Diagnósticos `NW-SVC-*`.

### 7. Wi-Fi

- Controladores, APs, radios, SSIDs, VLANs y seguridad.
- Canales, potencia, capacidad de clientes, roaming y PoE.
- Diagnósticos `NW-WIFI-*`.

### 8. IPv6 y VRF

- Prefijos IPv6, gateway, SLAAC, DHCPv6 y Router Advertisements.
- VRFs, route distinguisher y route leaking.
- Diagnósticos `NW-IPV6-*` y `NW-VRF-*`.

### 9. Simulación de fallos

- Fallos de dispositivo, enlace, circuito, proveedor, rack, energía, sede o servicio.
- Propagación de impacto y requisitos `mustSurvive`.
- Estados `survives`, `degraded` y `failed`.
- Diagnósticos `NW-FAIL-*`.

### 10. Estado observado y drift

- Comparación entre diseño y `observedState`.
- Recursos ausentes, inesperados y propiedades modificadas.
- Política configurable mediante `driftPolicy`.
- Los proyectos sin snapshot observado conservan compatibilidad.
- Diagnósticos `NW-DRIFT-*`.

## Informes añadidos

La Puerta de Producción expone:

```js
report.architecture
report.compatibility
report.physicalInventory
report.resilience
report.wan
report.capacity
report.services
report.wifi
report.ipv6Vrf
report.failureSimulation
report.observedDrift
```

## Compatibilidad

- Los nuevos arrays y objetos son opcionales.
- Un proyecto antiguo sin los nuevos bloques mantiene el comportamiento anterior.
- `observedState` solo activa el análisis de drift cuando se incluye explícitamente.
- El adaptador de validadores admite tanto `validate(project)` como `validateProject(project)`.

## Verificación

La cadena de validación de la rama incluye:

```bash
npm run release:check && npm run test:e2e
```

Además, cada módulo nuevo dispone de un test unitario específico y está incluido en `npm test` y `check:syntax`.

## Promoción

1. Fusionar el PR de `feat/diagnostics-link-validation` en `chore/stabilize-3.48.0`.
2. Ejecutar nuevamente la cadena completa sobre la rama de estabilización.
3. Actualizar las comprobaciones del PR de estabilización.
4. Promover `chore/stabilize-3.48.0` a `main` mediante el PR de baseline.
