# NetWizard v3.13 · Exportación de interfaces L3 de tránsito

Esta versión continúa la integración de redes de tránsito L3 iniciada en v3.11/v3.12.

## Cambios principales

- Nuevo módulo `js/netwizard-l3-config-utils.js` para recopilar interfaces routed con `l3Ip`/`l3Cidr`, peer físico, VLAN de tránsito y máscara/prefijo.
- Cisco IOS Router: las interfaces físicas con IP L3 asignada se exportan con `ip address`.
- Cisco IOS Switch/L3 Switch: los puertos `routed` o con IP L3 se exportan con `no switchport` e `ip address`.
- Juniper Junos: las interfaces con IP L3 se exportan como `family inet address` y se evita tratarlas como ethernet-switching.
- FortiGate: las interfaces físicas con IP L3 se exportan con `config system interface` y `set ip`.
- pfSense: la exportación documenta las interfaces L3 detectadas para configurarlas en la GUI.
- Tests añadidos para validar la recopilación de interfaces L3, máscara, prefijo, peer y VLAN de tránsito.

## Alcance prudente

La v3.13 no intenta crear todavía rutas estáticas, protocolos dinámicos ni políticas firewall basadas en intención. Solo propaga el direccionamiento L3 ya asignado a los generadores de configuración más relevantes.

## Validación ejecutada

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_13_l3_config_exports.zip
```
