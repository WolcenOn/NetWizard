# Escenarios de referencia 3.50

Los cuatro proyectos JSON son contratos funcionales, no solo datos de demostración. `production-scenarios.json` declara para cada uno:

- el resultado esperado de la puerta en modo producción estricto;
- los únicos avisos aceptados y documentados;
- los dispositivos cuya configuración debe generarse;
- firmas mínimas que identifican una salida válida por fabricante.

`ready` significa que la puerta no encuentra avisos ni bloqueos. `review` se admite únicamente cuando todos los avisos aparecen en `allowedWarningCodes`; nunca admite errores bloqueantes.

La suite unitaria valida schema, referencias y criterios de salida. Playwright importa los mismos archivos en el navegador publicado, ejecuta la puerta real, genera la configuración de cada equipo y comprueba también la documentación.


## Golden Path Secure Multisite

`golden-path-secure-multisite.json` es la referencia principal de diseño limpio de NetWizard.

Objetivos del sample:

- 4 sedes conectadas mediante 6 routers.
- Dos routers de core en HQ y doble camino OSPF desde cada sede.
- Todas las adyacencias OSPF observadas en estado FULL.
- Redes de tránsito /30 canónicas con `transitVlanRef`.
- 7 dominios de servicio por sede: usuarios, Wi-Fi corporativa, voz, servidores, cámaras/IoT, invitados y gestión.
- Reglas explícitas por sede para permitir únicamente los servicios necesarios y bloquear lateralidad.
- ACL Cisco vinculadas a las subinterfaces de origen.
- VTP transparente observado, hardening de acceso, gestión segura y Wi-Fi con controladores redundantes.
- Servicios internos redundantes por IP lógica.
- Presupuesto completo sin líneas sin precio.
- Private Production Gate en estado `READY`.

El botón principal **⭐ Golden Path seguro multisede** carga este archivo. Debe poder utilizarse como demo, referencia de arquitectura y regresión: si aparece un warning/error de diseño o el Production Gate deja de estar READY, el test `tests/golden-path-secure-multisite.test.js` falla.

## Golden Path Enterprise completo

`golden-path-enterprise-complete.json` es el showcase funcional más amplio de NetWizard. Está pensado para tres usos simultáneos:

1. demo comercial/técnica importable desde la UI;
2. referencia de cómo se relacionan las autoridades canónicas;
3. regresión de producto mediante `tests/golden-path-enterprise.test.js`.

Incluye dos sedes (HQ + sucursal), switching Cisco con LACP, VLAN/DHCP/VTP observado, gateways Cisco IOS, OSPF sobre transporte privado, doble Internet por sede, VPN IPsec primary/backup, tracking y rutas flotantes, seguridad de acceso, gestión, Wi-Fi, IPv6/VRF, servicios internos redundantes, perfiles de capacidad, escenarios de fallo, racks/PDU/PoE/cableado estructurado, un workflow de intervención con evidencias y aceptación, y BOM/presupuesto completo con CAPEX/OPEX.

El proyecto es deliberadamente **seguro para demostración**: los túneles VPN contienen `secretAlias`, nunca PSK reales. Por ello el Private Production Gate debe mantener los routers en `review-required`/bloqueado hasta que esos alias se resuelvan fuera del proyecto. Los switches Cisco sí deben quedar `apply-ready`. El sample de cuatro sedes continúa siendo la referencia de Production Gate totalmente `READY`.

En la pantalla de importación aparecen los botones **⭐ Cargar Golden Path completo** y **⬇ JSON Golden Path**, ambos usando exactamente este archivo.

## Golden Path Multisede limpio

`golden-path-multisite-clean.json` es la referencia **production-ready** de arquitectura multisede. A diferencia del showcase Enterprise, su criterio de salida es estricto: debe cargar sin errores ni avisos relevantes, el Production Gate debe quedar en `ready`, y todos los dispositivos Cisco deben quedar `apply-ready`.

Modela cuatro sedes — Central, Norte, Levante y Sur — unidas por cuatro routers Cisco IOS en un anillo OSPF. Cada router tiene dos vecinos y los cuatro enlaces P2P usan redes de tránsito canónicas /30, por lo que la pérdida de un enlace conserva comunicación entre sedes por el camino alternativo. Cada sede dispone de core + acceso Cisco con LACP, VLANs separadas para usuarios, servicios, voz, cámaras, invitados y gestión, además de una VLAN nativa no usada por usuarios.

La seguridad demostrable incluye DHCP Snooping, DAI y port-security en acceso, trunks con listas VLAN explícitas, Wi-Fi corporativa WPA2-Enterprise con RADIUS e invitados WPA3 con client isolation. La matriz inter-VLAN se traduce en Cisco IOS a ACLs por VLAN origen y se aplica `in` sobre cada subinterfaz RoaS, de modo que invitados → redes internas, cámaras → usuarios/gestión y usuarios → gestión quedan bloqueados en la configuración generada. Además, `management.sourceNetworks` genera una ACL estándar `NW_MGMT_SOURCES` aplicada con `access-class ... in` a las líneas VTY, limitando SSH a las subredes de administración. Reglas firewall manuales genéricas siguen requiriendo revisión si no tienen binding inequívoco; el Golden no depende de ellas.

El test `tests/golden-path-multisite-clean.test.js` exige Production Gate `ready` con 0 warnings, OSPF Observed FULL, reachability entre sedes, supervivencia ante fallo de cualquiera de los cuatro enlaces y bloqueos de segmentación. `tests/e2e/golden-path-multisite-clean.spec.js` repite el contrato cargando exactamente el mismo JSON desde el navegador.

En Importar/Exportar aparece **✅ Cargar Golden Multisede limpio** junto con **⬇ JSON Golden limpio**.

## Golden Path Oficina pequeña segura

`golden-path-office-modern.json` es la arquitectura de referencia moderna para el escenario **Oficina pequeña** del Asistente. Está pensada para una oficina de hasta unas decenas de usuarios y evita sobredimensionar la solución: un único borde gestionado, core + acceso PoE, LACP en la LAN y doble acceso WAN con tracking y ruta flotante.

El diseño aplica separación funcional para usuarios cableados, servicios, voz, cámaras/IoT, invitados, Wi-Fi corporativa, gestión y VLAN nativa/blackhole. La matriz inter-VLAN se usa como autoridad de mínimo privilegio: invitados quedan aislados de redes internas, cámaras solo alcanzan servicios autorizados y usuarios/voz/Wi-Fi corporativa no pueden administrar infraestructura. El acceso de gestión usa SSH restringido a la red de administración, logging/NTP/DNS centralizados y hardening L2 con DHCP Snooping, DAI y port-security.

La WLAN modela dos AP PoE gestionados, radios 2.4/5/6 GHz, SSID corporativo WPA3-Enterprise con RADIUS y SSID de invitados WPA3 con client isolation. El proyecto incluye además IPv6 dual-stack en usuarios, Wi-Fi corporativa y gestión, dos circuitos WAN independientes, perfiles de capacidad, escenarios de fallo, rack/PDU/cableado estructurado y BOM/presupuesto completos.

La Golden debe mantenerse en Production Gate estricto `READY` con cero warnings. No activa AAA, SNMPv3 ni backup autenticado dentro del proyecto porque esas funciones requieren aliases de secretos que el runtime actual todavía no resuelve de forma separada; no se introducen secretos falsos para conseguir un estado verde.

El Asistente carga este JSON como fuente canónica mediante **Oficina pequeña → Cargar ejemplo · Golden Path Oficina pequeña segura**.

## Golden Path Home Lab moderno y segmentado

`golden-path-home-lab-modern.json` es la arquitectura de referencia para **Home Lab**. Está pensada para un laboratorio doméstico serio y actual, con separación entre uso personal, servicios, experimentación, IoT, invitados, almacenamiento/backup y administración, sin convertir el escenario en una empresa en miniatura.

El diseño usa un edge router, core y acceso PoE/multigig gestionados, un LACP de 2×10G entre core y acceso, dos circuitos WAN independientes y dos AP tri-band con 2.4/5/6 GHz. Las WLAN `LAB-TRUSTED`, `LAB-IOT` y `LAB-GUEST` usan WPA3-Personal; IoT e invitados activan client isolation. La VLAN nativa se reserva como blackhole y la gestión solo se permite desde la red de administración.

Las políticas de segmentación bloquean invitados e IoT frente a las redes internas, separan la zona de experimentación de Trusted/Management y limitan Storage/Backup a Servers y Management. DHCP Snooping, DAI, port-security y BPDU protections se mantienen activos en acceso. DNS, NTP y Syslog tienen endpoints redundantes y el laboratorio incluye monitoring, failover WAN, fallo de miembro LACP y perfiles de capacidad.

El ejemplo representa dual-stack en todas las redes útiles. La misma separación lógica se mantiene para IPv4 e IPv6; los prefijos `2001:db8::/32` son de documentación y deben sustituirse por prefijos reales antes de un despliegue externo.

El modelo físico incluye rack 18U, PDU, patch panel Cat6A, nueve tendidos —incluidos ambos AP—, patching y conexiones de host. BOM y presupuesto deben quedar completamente valorados.

Como en las demás Golden Paths estrictas, AAA/SNMPv3/backup autenticado no se activan con secretos ficticios: esas funciones se incorporarán cuando el runtime pueda resolver aliases de secretos sin persistir credenciales en el proyecto.

El Asistente carga este JSON mediante **Home Lab → Cargar ejemplo · Golden Path Home Lab moderno y segmentado**.


## Golden Path Retail / Comercio segmentado

`golden-path-retail-modern.json` es la arquitectura de referencia para el escenario **Retail / Comercio** del Asistente. Representa una tienda con terminales POS, servicios locales, puestos de empleados, cámaras y NVR, IoT, Wi-Fi de clientes, red de gestión y una VLAN nativa/blackhole, sin convertir una tienda individual en una arquitectura empresarial sobredimensionada.

El diseño usa un router de borde, core + acceso PoE, LACP en la LAN, dos accesos WAN independientes con tracking y ruta flotante, y dos AP tri-band. La WLAN de empleados usa WPA3-Enterprise con RADIUS; las WLAN de IoT e invitados usan WPA3-Personal con client isolation. La red de gestión queda restringida a su subnet administrativa y el acceso incorpora DHCP Snooping, DAI, port-security y protecciones BPDU.

La segmentación busca reducir el alcance del entorno de pago: POS no puede iniciar tráfico hacia empleados, cámaras/NVR, IoT, invitados ni gestión; invitados quedan aislados de todas las redes internas; cámaras e IoT solo reciben la conectividad inter-VLAN explícitamente necesaria. Esta arquitectura está **inspirada en prácticas de segmentación apropiadas para entornos de pago**, pero NetWizard no declara ni certifica cumplimiento PCI DSS completo.

El Golden mantiene dual-stack IPv4/IPv6 con paridad de política, servicios DNS/NTP/Syslog/RADIUS redundantes, escenarios de fallo de WAN y miembro LACP, rack, PDU, patch panel, cableado Cat6A y BOM/presupuesto completamente valorados. Como en los demás Golden estrictos, AAA/SNMPv3/backup autenticado no se activan con secretos ficticios.

El Asistente carga este JSON mediante **Retail / Comercio → Cargar ejemplo · Golden Path Retail / Comercio segmentado** y su contrato exige Production Gate estricto `READY` con cero warnings.
