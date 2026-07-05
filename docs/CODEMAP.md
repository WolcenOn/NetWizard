# Mapa de código - `js/netwizard.js`

## 00. Bootstrap, DOM helpers y constantes
Variables globales principales, helpers `$`, `qsa`, escenarios del asistente, plantillas firewall y catálogos.

## 01. Estado, migraciones ligeras y storage
`defS`, `loadS`, `save` y normalizaciones iniciales del estado.

## 02. Ubicaciones físicas
Jerarquía física, formularios de ubicación y sincronización con hosts/dispositivos.

## 03. Helpers comunes e IP/subnetting
`uid`, parsing IP/CIDR, cálculo de subnets, lookups y nombres de puertos.

## 04. Generadores de configuración
Generadores Cisco IOS, Cisco ASA, Juniper, Aruba, pfSense, FortiGate, Windows Server y Linux.

## 05. Navegación, dashboard y asistente
Cambio de paso, navegación lateral/inferior, dashboard y wizard de escenarios.

## 06. Dispositivos
Alta, edición, borrado y renderizado de routers, switches, firewalls y dispositivos base.

## 07. Puertos e interfaces
Selectores de dispositivo, roles, puertos access/trunk/routed/WAN/LAN y listados.

## 08. VLANs y subnets
VLANs, subnetting manual/automático, gateways, selectores y listados.

## 09. Hosts y mapa IP
Hosts, IP estática/DHCP, asignación de puerto, filtros y mapa IP por VLAN.

## 10. Puertos visuales y enlaces
Layout de puertos, generación masiva, vista de puertos y enlaces entre interfaces.

## 11. Firewall, matriz inter-VLAN y hardening
Reglas manuales, plantillas, matriz, ACLs generadas y perfiles de hardening.

## 12. RoaS, DHCP, config por dispositivo y VTP
Router-on-a-stick, DHCP, selección de vendor/formato y configuración VTP.

## 13. Topología clásica
Canvas `topo`, layout automático, render de nodos y enlaces.

## 14. Vista visual V5
Canvas avanzado `v5view`, ubicaciones, drag/drop, fullscreen y panel lateral.

## 15. Event listeners e inicialización
Conexión de la UI con handlers y llamada final a `refresh()`.
