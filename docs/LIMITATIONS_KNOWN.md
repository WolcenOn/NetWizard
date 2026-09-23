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
- Cisco IOS/ASA, Junos, Aruba AOS-S, FortiGate, Huawei VRP y MikroTik producen configuración o bloques CLI según el soporte disponible; UniFi, Omada y Galgus pueden requerir flujo de controlador/cloud o revisión manual según plataforma.
- pfSense genera un script PHP de aprovisionamiento revisable por firewall/sede. Usa APIs/configuración internas de pfSense y debe probarse en laboratorio con backup de `config.xml`; no se considera un formato universal entre versiones.
- Algunos vendors pueden necesitar ajustes por versión, licencia o sintaxis específica.

## Modelo y evolución

- La línea `3.50.0` es el contrato canónico actual. Mantiene migración compatible desde proyectos 3.28–3.48 y formaliza también el modelo físico de racks, PDU/alimentación y cableado estructurado.
- El pipeline 3.50 usa un registro inspeccionable de renderers/etapas y mantiene compatibilidad con integraciones legacy; todavía existe código UI histórico en `js/netwizard.js` que conviene seguir modularizando.
- `kind` es el identificador canónico de clase de dispositivo en 3.50 y `type` se mantiene como espejo compatible durante la transición.

## Informes e impresión

- Las matrices de puertos están optimizadas para consulta digital y pueden usar desplazamiento horizontal.
- En impresión/PDF, proyectos con muchos puertos todavía necesitan una paginación dedicada por bancos para garantizar que ningún puerto quede fuera del área imprimible. Esta optimización queda pendiente de una pasada específica de maquetación para papel.

## Seguridad

- Se ha añadido sanitización, pero cualquier JSON importado debe considerarse no confiable.
- Si la app se publica en red, añadir CSP, hosting seguro y controles de acceso externos.
