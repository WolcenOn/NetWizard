# NetWizard v3.16 · Políticas firewall/ACL desde intención VLAN

Esta versión añade una primera capa conservadora para convertir la intención por VLAN en propuestas de reglas firewall/ACL.

## Cambios principales

- Nuevo módulo `js/netwizard-policy-utils.js`.
- Nueva tarjeta en Firewall & Seguridad: **Políticas desde intención VLAN**.
- Previsualización no destructiva de reglas generadas desde intención.
- Botón para aplicar esas reglas como reglas editables en `fwRules`.
- Snapshot automático antes de aplicar reglas generadas.
- Integración con exportadores existentes mediante `allFirewallRules()`.
- Integración con la auditoría de preparación/producción.

## Alcance prudente

La generación no pretende sustituir una revisión de seguridad. Produce una base razonable para escenarios comunes:

- Invitados: bloquear redes internas, permitir DNS/DHCP e Internet HTTP/HTTPS.
- IoT: bloquear lateralidad interna, permitir DNS/NTP/MQTT y HTTPS si procede.
- Cámaras: bloquear lateralidad interna, permitir DNS/NTP y servicios de vídeo/NVR genéricos.
- DMZ: bloquear DMZ hacia LAN y registrar tráfico.
- Gestión: permitir SSH/HTTPS/SNMP desde VLAN de gestión.
- Voz: permitir SIP/RTP básicos.

## Vendors afectados

Las reglas generadas se mezclan con reglas manuales al exportar:

- Cisco IOS ACL.
- Cisco ASA ACL básica.
- FortiGate policy básica.
- pfSense como documentación comentada para GUI/configuración.
- Linux iptables en reglas permitidas.

## Validación

Se añaden códigos:

- `NW-POL-001`: VLAN aislada/restringida sin denegación interna.
- `NW-POL-002`: VLAN con Internet requerido sin regla/NAT evidente.
- `NW-POL-003`: VLAN sin subnet, por lo que las reglas se degradan a etiquetas VLAN.

## Limitaciones conocidas

- No hay todavía objetos/address-groups por vendor.
- No hay selección explícita de interfaces/zones por regla.
- No hay destinos de aplicación concretos como broker MQTT, NVR, DNS corporativo o controlador VoIP.
- Las reglas generadas son una propuesta inicial y deben revisarse antes de producción.
