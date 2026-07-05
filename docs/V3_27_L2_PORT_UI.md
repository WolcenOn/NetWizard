# NetWizard v3.27 · UI L2 completa para puertos

Esta versión añade edición visible de parámetros L2 críticos directamente desde la web, sin depender de editar JSON manualmente.

## Cambios

- Añadidos campos en el formulario de puertos para VLAN nativa, VLANs permitidas, uplink y protección access.
- Añadidos campos equivalentes en el modal de edición rápida de puerto.
- La tabla de puertos muestra datos L2 relevantes: native VLAN, número de VLANs permitidas, uplink, PortFast/BPDU Guard desactivados.
- La auditoría L2 mantiene sus reglas de v3.26 y añade helpers para recomendaciones por puerto.
- Schema actualizado a `3.27.0`.

## Uso recomendado

1. Configura los puertos access con VLAN y protección recomendada.
2. Configura trunks con VLANs permitidas explícitas.
3. Define VLAN nativa en trunks, evitando VLAN 1 en producción.
4. Marca uplinks para ayudar a la auditoría L2.
5. Ejecuta la auditoría L2 avanzada y la puerta de producción antes de exportar.
