# Limitaciones conocidas

## Alcance de producción

- Aplicación estática/local, sin backend.
- Sin usuarios, roles ni permisos.
- Sin logs centralizados de cambios.
- Sin backup remoto.
- Sin integración directa con equipos reales.

## Validaciones

- Las auditorías de cableado, PoE y broadcast son estimaciones de diseño.
- No reemplazan mediciones reales de switch, SNMP, NetFlow, SPAN o telemetría.
- La validación L2 depende de que el modelo tenga enlaces, puertos y VLANs bien informados.

## Vendor exports

- Las configuraciones generadas son plantillas iniciales y deben revisarse antes de aplicar en equipos reales.
- Cisco IOS/ASA, Junos, Aruba AOS-S, FortiGate, Huawei VRP y MikroTik producen configuración o bloques CLI; UniFi, Omada, Galgus y pfSense producen planes aplicables/revisables cuando no existe un formato universal seguro.
- pfSense se documenta principalmente como guía porque su configuración real suele gestionarse con GUI/config.xml.
- Algunos vendors pueden necesitar ajustes por versión, licencia o sintaxis específica.

## Modelo y evolución

- La línea `3.48.0` conserva compatibilidad de schema mientras normaliza las ramas avanzadas ya utilizadas por routing, HA, WAN, Wi-Fi, VRF, inventario, simulación y drift.
- El pipeline de generadores sigue siendo una cadena ordenada de integraciones sobre el núcleo clásico. El entrypoint y el runtime fijan y verifican ese orden; una futura versión menor debería sustituirlo por un registro de etapas sin mutar `window.genConfig`.
- La clasificación de roles de infraestructura más allá de switch/router/firewall todavía requiere una migración de modelo coordinada con UI, capacidades y schema.

## Seguridad

- Se ha añadido sanitización, pero cualquier JSON importado debe considerarse no confiable.
- Si la app se publica en red, añadir CSP, hosting seguro y controles de acceso externos.
