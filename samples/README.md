# Escenarios de referencia 3.50

Los cuatro proyectos JSON son contratos funcionales, no solo datos de demostración. `production-scenarios.json` declara para cada uno:

- el resultado esperado de la puerta en modo producción estricto;
- los únicos avisos aceptados y documentados;
- los dispositivos cuya configuración debe generarse;
- firmas mínimas que identifican una salida válida por fabricante.

`ready` significa que la puerta no encuentra avisos ni bloqueos. `review` se admite únicamente cuando todos los avisos aparecen en `allowedWarningCodes`; nunca admite errores bloqueantes.

La suite unitaria valida schema, referencias y criterios de salida. Playwright importa los mismos archivos en el navegador publicado, ejecuta la puerta real, genera la configuración de cada equipo y comprueba también la documentación.


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

La seguridad demostrable incluye DHCP Snooping, DAI, IP Source Guard/port-security, trunks con listas VLAN explícitas, gestión restringida a las subredes de administración, Wi-Fi corporativa WPA2-Enterprise con RADIUS, invitados WPA3 con client isolation y una matriz de segmentación que bloquea invitados hacia redes internas, cámaras hacia usuarios/gestión y usuarios hacia gestión. Las políticas L3 avanzadas que todavía no tienen binding ACL interfaz/dirección certificado en Cisco IOS no se presentan como seguridad aplicada.

El test `tests/golden-path-multisite-clean.test.js` exige Production Gate `ready` con 0 warnings, OSPF Observed FULL, reachability entre sedes, supervivencia ante fallo de cualquiera de los cuatro enlaces y bloqueos de segmentación. `tests/e2e/golden-path-multisite-clean.spec.js` repite el contrato cargando exactamente el mismo JSON desde el navegador.

En Importar/Exportar aparece **✅ Cargar Golden Multisede limpio** junto con **⬇ JSON Golden limpio**.
