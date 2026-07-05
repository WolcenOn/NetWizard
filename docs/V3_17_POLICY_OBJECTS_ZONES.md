# NetWizard v3.17 · Objetos, servicios y zonas para políticas

Esta iteración mejora la generación de reglas firewall/ACL derivadas de intención VLAN sin cambiar el flujo principal del usuario.

## Cambios principales

- `netwizard-policy-utils.js` ahora construye un contexto de políticas con:
  - objetos de red por VLAN/subnet,
  - zona lógica por intención (`guest`, `iot`, `dmz`, `mgmt`, etc.),
  - interfaz lógica esperada por VLAN (`VLAN10`, `VLAN20`, ...),
  - servicios normalizados (`HTTP`, `HTTPS`, `DNS`, `NTP`, `MQTT`, etc.).
- Las reglas pueden enriquecerse con:
  - `srcObject`, `dstObject`,
  - `srcZone`, `dstZone`,
  - `srcInterface`, `dstInterface`,
  - `serviceNames`.
- Cisco ASA exporta objetos de red y usa objetos en ACLs cuando la regla apunta a una subnet conocida.
- FortiGate exporta objetos de dirección, zonas lógicas y políticas usando objetos/zonas cuando existen datos suficientes.
- pfSense documenta objetos/zones como guía operativa antes de listar las reglas.
- Cisco IOS ACL divide puertos separados por coma en entradas explícitas, evitando usar solo el primer puerto.

## Criterio prudente

Las zonas se derivan de la intención VLAN y de las interfaces VLAN esperadas. Si el proyecto no define claramente una interfaz real o una subnet, la exportación conserva comentarios/etiquetas y evita inventar datos críticos.

## Limitaciones conocidas

- FortiGate puede requerir ajustar nombres de interfaces/zonas si el equipo real usa otro naming.
- ASA todavía usa una ACL base única; queda pendiente mapear ACLs por interfaz/zona real.
- pfSense se mantiene como guía comentada, no como `config.xml` completo.
- Las reglas siguen requiriendo revisión de seguridad antes de aplicarse en producción.

## Pruebas

Se añadieron tests para validar:

- creación de contexto VLAN → objeto/zona/interfaz,
- enriquecimiento de reglas con objetos y servicios vendor-friendly.
