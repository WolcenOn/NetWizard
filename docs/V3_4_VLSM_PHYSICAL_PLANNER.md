# NetWizard v3.4 · VLSM y planificación desde capa 1

## Objetivo

Esta versión añade una primera implementación del flujo deseado: definir la red física y las VLANs, auditar incompatibilidades de capa 1 y generar un plan IP automático con VLSM.

## Cambios añadidos

- Nuevo módulo `js/netwizard-vlsm-physical-planner.js`.
- Nueva tarjeta en **VLANs & Subnets**: `VLSM automático por necesidad`.
- Nueva tarjeta en **Puertos & Enlaces**: `Auditoría capa 1`.
- Tests Node.js para VLSM, auditoría física y asignación de IPs.

## Qué valida la auditoría de capa 1

- Enlaces con puertos o dispositivos inexistentes.
- Un mismo puerto usado en más de un enlace.
- Puerto conectado consigo mismo.
- Enlaces entre puertos del mismo dispositivo, marcados como aviso por posible loop.
- Medios posiblemente incompatibles, por ejemplo SFP contra GE/FE.
- Trunk conectado a access.
- Routed conectado a access.
- Hosts conectados a puertos trunk.
- Hosts cuya VLAN no coincide con la VLAN access del puerto.
- VLANs con hosts pero sin subnet.

## Qué hace el planificador VLSM

El planificador calcula la necesidad por VLAN usando:

- Hosts existentes en la VLAN.
- Dispositivos IoT asociados a la VLAN.
- Puertos access de esa VLAN, ponderados como capacidad esperada.
- Una reserva de crecimiento configurable por VLAN.

Después ordena las VLANs de mayor a menor necesidad y asigna bloques sin solapamiento dentro del bloque base.

## Modos de asignación IP

- `Solo estáticos sin IP`: mantiene DHCP y solo rellena hosts marcados como estáticos sin IP.
- `Todos los hosts de VLAN`: convierte/asigna IP estática a todos los hosts de cada VLAN.
- `No tocar hosts`: solo actualiza subnets y gateways.

## Limitaciones conocidas

- La intención de red todavía se infiere de hosts, puertos e IoT; no hay aún un formulario avanzado de objetivos por VLAN.
- La auditoría no sustituye un simulador L2/L3 completo.
- No hay pruebas E2E Playwright en navegador todavía.
- La compatibilidad de medios es conservadora y puede generar avisos en escenarios válidos con transceptores/adaptadores.

## Comprobaciones

```bash
npm test
npm run check:syntax
```
