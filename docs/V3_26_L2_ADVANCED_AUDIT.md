# NetWizard v3.26 · Auditoría L2 avanzada

Esta versión añade una capa de validación de switching L2 para acercar el proyecto a un uso de producción.

## Nuevo módulo

- `js/netwizard-l2-utils.js`

Expone:

- `NetWizardL2Utils.auditL2(project)`
- `NetWizardL2Utils.summarizeL2Audit(audit)`
- helpers de VLAN permitida/nativa para tests y futuras pantallas.

## Qué valida

- Trunks sin VLANs permitidas.
- Trunks que transportan todas las VLANs.
- VLAN nativa ausente, VLAN 1 como nativa o nativa no incluida en allowed VLANs.
- Mismatch de VLAN nativa entre dos trunks conectados.
- Trunks conectados contra puertos no trunk.
- Puertos access que parecen uplinks.
- Puertos access con host sin PortFast/BPDU Guard explícitos.
- Switches con hosts access sin uplink detectado.
- VLANs con hosts/gateway IP sin continuidad L2 hacia un gateway L3.

## Nuevos códigos

- `NW-L2-001` trunk sin VLANs permitidas.
- `NW-L2-002` trunk demasiado abierto.
- `NW-L2-003` trunk sin VLAN nativa definida.
- `NW-L2-004` VLAN 1 usada como nativa.
- `NW-L2-005` nativa fuera de allowed VLANs.
- `NW-L2-010` uplink en modo access.
- `NW-L2-020` trunks conectados sin VLANs comunes.
- `NW-L2-021` mismatch de VLAN nativa.
- `NW-L2-022` trunk contra no-trunk.
- `NW-L2-030` switch con hosts sin uplink.
- `NW-L2-040` VLAN con hosts sin gateway.
- `NW-L2-041` gateway IP sin dispositivo L3 detectable.
- `NW-L2-042` VLAN sin continuidad hacia gateway.

## Integración

La auditoría se muestra en una tarjeta nueva del dashboard y también se integra en la Puerta de Producción. En modo producción, los códigos `NW-L2-*` pueden bloquear exportaciones si representan riesgo operativo.
