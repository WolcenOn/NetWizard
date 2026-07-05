# NetWizard v3.11 · VLSM para tránsito L3

Esta versión añade soporte inicial y prudente para tratar los enlaces entre dispositivos de red como redes de tránsito dedicadas.

## Cambios principales

- Las VLANs con intención `transit` se dimensionan por defecto para 2 hosts.
- El plan VLSM genera normalmente `/30` para esas VLANs cuando no hay margen adicional.
- La auditoría de capa 1 detecta enlaces L3/routed entre routers, firewalls o switches L3 sin una VLAN/red de tránsito asociada.
- `readinessAudit` añade códigos de auditoría específicos:
  - `NW-L3-010`: enlace L3 sin VLAN/red de tránsito.
  - `NW-L3-011`: enlace L3 apunta a VLAN de tránsito inexistente.
  - `NW-L3-012`: VLAN usada como tránsito pero sin intención `transit`.
  - `NW-L3-013`: VLAN de tránsito sin subnet.

## Modelo soportado

Para asociar una red de tránsito a un enlace físico se puede usar alguno de estos campos:

```json
{
  "id": "l1",
  "aPortId": "p1",
  "bPortId": "p2",
  "transitVlanRef": "v99"
}
```

También se aceptan, por compatibilidad inicial:

- `link.vlanRef`
- `link.l3VlanRef`
- `port.routedVlanRef`
- `port.transitVlanRef`

## Limitaciones conocidas

- Todavía no se asignan IPs a interfaces routed de routers/switches L3; solo se planifica la subnet de tránsito.
- Todavía no hay UI específica para escoger `transitVlanRef` desde el formulario de enlaces.
- `/31` no se activa automáticamente; se mantiene `/30` por compatibilidad y seguridad.
- La generación vendor todavía no configura interfaces L3 punto a punto desde esta información.

## Pruebas

Añadidos tests para:

- Dimensionamiento `/30` de VLANs de tránsito.
- Aviso cuando un enlace L3 no tiene red de tránsito.
- Aceptación de enlace L3 con VLAN de tránsito y subnet válida.
