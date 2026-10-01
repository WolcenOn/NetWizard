# Escenarios de referencia 3.50

Los cuatro proyectos JSON son contratos funcionales, no solo datos de demostración. `production-scenarios.json` declara para cada uno:

- el resultado esperado de la puerta en modo producción estricto;
- los únicos avisos aceptados y documentados;
- los dispositivos cuya configuración debe generarse;
- firmas mínimas que identifican una salida válida por fabricante.

`ready` significa que la puerta no encuentra avisos ni bloqueos. `review` se admite únicamente cuando todos los avisos aparecen en `allowedWarningCodes`; nunca admite errores bloqueantes.

La suite unitaria valida schema, referencias y criterios de salida. Playwright importa los mismos archivos en el navegador publicado, ejecuta la puerta real, genera la configuración de cada equipo y comprueba también la documentación.


## Golden Path Multisite Secure

`golden-path-enterprise-complete.json` es el golden principal de NetWizard y debe cargar **sin errores ni warnings arquitectónicos**. Modela cuatro sedes (Central, Norte, Levante y Sur) conectadas por cuatro routers Cisco IOS en un anillo OSPF con dos caminos posibles entre sedes.

El proyecto demuestra una red empresarial segmentada por servicio: USERS, Wi-Fi corporativa, VOICE, SERVERS, CCTV/IoT y MGMT. Cada VLAN tiene gateway propietario explícito, DHCP donde corresponde y políticas inter-VLAN con `ingressVlanRef`. El Private Engine genera una ACL Cisco por VLAN y la aplica `in` a la subinterfaz correcta; las reglas sin binding explícito continúan siendo `review-required`.

También incluye VTP transparent con evidencia Observed, LACP core-access, PortFast/BPDU Guard, DHCP Snooping, DAI, IP Source Guard, port-security sticky, gestión SSH restringida a redes MGMT, Wi-Fi corporativa con RADIUS, IPv6, servicios internos redundantes, capacidad de enlaces, racks/PDU/PoE/cableado y BOM/presupuesto completo.

El contrato automático exige:
- Architecture Validator sin warnings;
- OSPF válido y vecinos Observed FULL en los cuatro routers;
- reachability inter-sede permitida para flujos autorizados;
- USERS bloqueados hacia MGMT y CCTV;
- continuidad HQ↔Norte al retirar uno de los enlaces del anillo;
- VTP/Wi-Fi/IPv6/servicios/capacidad/seguridad/gestión sin warnings;
- BOM sin líneas sin precio;
- todos los routers y switches `apply-ready`;
- Production Gate `READY`.

En la pantalla de importación aparecen **⭐ Cargar Golden Path completo** y **⬇ JSON Golden Path**, ambos usando exactamente este JSON.
