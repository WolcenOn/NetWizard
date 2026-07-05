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
- pfSense se documenta principalmente como guía porque su configuración real suele gestionarse con GUI/config.xml.
- Algunos vendors pueden necesitar ajustes por versión, licencia o sintaxis específica.

## Seguridad

- Se ha añadido sanitización, pero cualquier JSON importado debe considerarse no confiable.
- Si la app se publica en red, añadir CSP, hosting seguro y controles de acceso externos.
