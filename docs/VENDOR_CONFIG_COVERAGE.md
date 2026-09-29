# Cobertura de generación de configuración

La generación privada distingue entre **modo de salida** y **certificación de aplicabilidad**. Que exista un artefacto no implica que pueda aplicarse sin revisión.

| Vendor / plataforma | Tipos cubiertos | Salida | Estado actual |
| --- | --- | --- | --- |
| Cisco IOS | Router, switch | CLI | Puede llegar a `apply-ready` cuando no hay inferencias/placeholders/políticas no vinculadas. |
| Cisco ASA | Firewall | CLI | `review-required`; el artefacto ya se finaliza dentro de `configure terminal → end → write memory`. |
| Juniper Junos | Router, switch | CLI | `review-required`; se normaliza a `configure → ... → commit check → commit and-quit`. Falta certificar familia/modelo/versión. |
| Huawei VRP | Router, switch | CLI | `review-required`; se normaliza a `system-view → ... → return → save`. Falta certificar familia/modelo/versión. |
| MikroTik RouterOS | Router, switch | CLI/script RouterOS | `review-required`; faltan perfiles RouterOS/familia y validación de comandos por versión. |
| Fortinet FortiGate | Firewall | CLI | `review-required`; falta certificar FortiOS/modelo y políticas/HA según plataforma. |
| Aruba AOS-Switch | Switch | CLI | `review-required`; se normaliza a una sesión de configuración y guardado. Falta certificar familia/versión. |
| pfSense | Firewall, router | Procedimiento | `procedure-only`; se entrega como `.txt`, no como PHP ejecutable. |
| Ubiquiti UniFi | AP, controlador, switch | Procedimiento/controlador | `procedure-only`. |
| TP-Link Omada | AP, controlador, switch | Procedimiento/controlador | `procedure-only`. |
| Galgus Cloud | AP, controlador | Procedimiento/controlador | `procedure-only`. |
| Windows | Servidor | PowerShell | `review-required`; solo se genera si un host está vinculado al dispositivo mediante `host.deviceRef`. |
| Linux | Servidor | Shell | `review-required`; solo se genera si un host está vinculado al dispositivo mediante `host.deviceRef`. |
| Genérico / desconocido | — | — | Bloqueado: no se inventa configuración. |

## Regla vendor + tipo

El Private Engine no debe elegir un generador únicamente por `vendorOs`. También valida el `kind` del dispositivo. Ejemplos:

- un AP Huawei no usa automáticamente el generador VRP de router/switch;
- Cisco ASA solo se genera para dispositivos firewall;
- FortiGate se trata como firewall;
- Windows/Linux solo se generan para dispositivos de tipo servidor.

Una combinación no cubierta produce `NW-PRIVATE-CONFIG-004` y no crea un artefacto engañoso.

## Servidores gestionados

`host.connectedDeviceId` documenta el equipo de red al que se conecta un host. No identifica el servidor que ese host representa.

Para Windows/Linux se usa la referencia existente `host.deviceRef → device.id`. La UI permite editarla como **Dispositivo gestionado representado**. Si no existe una relación inequívoca, el Private Engine bloquea la generación en vez de emitir direcciones o servicios de ejemplo.

Los scripts de servidor:

- no abren RDP/HTTP por defecto;
- no inventan `10.10.10.10` ni gateways;
- Windows exige `-InterfaceAlias`;
- Linux exige `NET_IFACE`;
- usan la VLAN/IP/gateway del host vinculado.

## Camino para convertir vendors en apply-ready

Para promocionar una familia de `review-required` a `apply-ready` se necesita:

1. perfil identificable de plataforma/modelo/versión;
2. generador específico para ese perfil;
3. finalizador que deje una sesión aplicable completa;
4. ausencia de placeholders/inferencias no resueltas;
5. fixtures dorados para router/switch/firewall según corresponda;
6. validador estructural y semántico por vendor;
7. Playwright que muestre el artefacto server-side;
8. Production Gate en verde para el deployment global.

La certificación debe ser conservadora: si el modelo/versión no permite demostrar la sintaxis correcta, el artefacto sigue siendo útil como CLI revisable, pero no se etiqueta `apply-ready`.
