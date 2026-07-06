# NetWizard · matriz de generación de configuración

Este documento define el estado esperado de la generación de configuración por fabricante y sirve como guía para priorizar tests y desarrollo.

## Objetivo inmediato

Conseguir que ningún dispositivo configurado en NetWizard termine con una salida vacía o inútil. Si todavía no existe CLI real para un fabricante, debe generarse como mínimo un **plan de configuración seguro y accionable**.

## Estados

| Estado | Significado |
|---|---|
| CLI real | Genera comandos aplicables tras revisión humana. |
| Plan controlado | Genera pasos para controlador/cloud/API, no comandos inventados. |
| Fallback genérico | Genera inventario de VLANs/puertos/subnets para guiar configuración manual. |
| Pendiente | No debería quedar en producción. |

## Matriz actual

| Vendor OS | Tipo | Estado | Salida esperada |
|---|---|---|---|
| `cisco_ios` | switch/router | CLI real + fallback router | VLANs, trunks, access, RoaS, DHCP, NAT, ACL cuando aplica. |
| `cisco_asa` | firewall | CLI existente | Interfaces, NAT/ACL según lógica actual. |
| `juniper_junos` | router/switch/firewall | CLI existente | Configuración Junos según lógica actual. |
| `aruba_aoss` | switch | CLI existente | VLANs/puertos según lógica actual. |
| `pfsense` | firewall | salida existente / plan | Revisión pendiente para separar config real vs plan. |
| `fortinet` | firewall | CLI existente | Revisión pendiente para policy objects completos. |
| `windows` | endpoint/server | salida existente | Revisión pendiente. |
| `linux` | endpoint/server | salida existente | Revisión pendiente. |
| `mikrotik_routeros` | router/AP | CLI inicial | Bridge VLAN filtering, VLAN interfaces, IP, DHCP, NAT. |
| `huawei_vrp` | router/switch/AP | CLI inicial | VLAN batch, Vlanif, trunk, DHCP interface, ruta default. |
| `ubiquiti_unifi` | AP/controlador | Plan controlado | VLANs/redes, SSID, uplink trunk, aislamiento cliente. |
| `tplink_omada` | AP/controlador | Plan controlado | VLANs/redes, SSID, uplink trunk, aislamiento cliente. |
| `galgus_cloud` | AP/controlador | Plan controlado | VLANs/redes, SSID, uplink trunk, aislamiento cliente. |
| otro | cualquiera | Fallback genérico | Puertos, VLANs, subnets y advertencia de vendor no implementado. |

## Criterios de aceptación por vendor

Cada vendor debe tener al menos estos tests:

1. No devuelve `Sin vendor asignado`.
2. Incluye el nombre del dispositivo saneado.
3. Incluye VLANs relevantes.
4. Incluye interfaces/puertos relevantes.
5. Si es router/firewall, incluye gateway/ruta/NAT/firewall cuando aplique.
6. No incluye secretos reales; usa alias o advertencias.
7. Misma entrada produce misma salida.

## Casos Cisco prioritarios

### Cisco IOS switch

Debe generar:

- `hostname`.
- `vlan <id>` y `name`.
- Puertos access con `switchport mode access`.
- Puertos trunk con VLANs permitidas.
- PortFast/BPDU Guard cuando corresponda.
- Comentarios explicativos.

### Cisco IOS router con RoaS explícito

Debe generar usando la lógica principal:

- Subinterfaces `interface <lan>.<vlan>`.
- `encapsulation dot1Q`.
- IP gateway por VLAN.
- DHCP pools si están activos.
- WAN si `internetEdge=yes`.
- Default route.
- NAT.
- ACL/firewall si procede.

### Cisco IOS router sin RoaS explícito

Debe generar fallback inferido con advertencia:

- Aviso de que RoaS fue inferido.
- LAN/WAN inferidas por rol/nombre de puerto.
- Subinterfaces VLAN con gateway.
- DHCP/NAT/ruta si hay datos suficientes.

## Backend y generación

Cuando exista backend Go, la generación debe funcionar en dos modos:

### Modo frontend

La app genera localmente como hasta ahora.

### Modo backend

El backend recibe un snapshot de proyecto y devuelve:

```json
{
  "ok": true,
  "projectVersion": 42,
  "outputs": [
    {
      "deviceId": "r1",
      "vendorOs": "cisco_ios",
      "filename": "RTR-EDGE-01.cisco_ios.txt",
      "content": "..."
    }
  ],
  "warnings": []
}
```

Antes de portar generación a Go, conviene estabilizar las salidas JS y capturarlas con tests de snapshot o tests estructurales.

## Próximo trabajo recomendado

1. Añadir tests para Cisco IOS con RoaS explícito.
2. Añadir tests para Fortinet y pfSense.
3. Mejorar MikroTik DHCP para usar rangos reales, no placeholder.
4. Mejorar Huawei NAT según modelo/rol.
5. Añadir exportación agrupada por fabricante y por ubicación.
6. Definir contrato `/api/projects/{id}/generate-config` para el backend Go.
