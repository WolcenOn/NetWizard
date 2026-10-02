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
