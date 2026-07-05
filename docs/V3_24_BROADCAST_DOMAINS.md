# NetWizard v3.24 · Auditoría de dominios broadcast

Esta versión añade una auditoría prudente de dominios broadcast para mejorar eficiencia y segmentación de red.

## Nuevo módulo

- `js/netwizard-broadcast-utils.js`

API principal:

- `collectVlanStats(project)`
- `auditBroadcastDomains(project, options)`
- `summarizeBroadcastAudit(audit)`

## Qué analiza

Por cada VLAN estima riesgo usando:

- Tamaño de subnet y hosts útiles.
- Endpoints existentes y capacidad prevista desde intención VLAN.
- Densidad de IoT, cámaras y voz.
- Trunks que parecen transportar todas las VLANs.
- Mezcla de dispositivos ruidosos en VLANs no especializadas.

## Nuevos códigos de auditoría

- `NW-BCAST-001`: subred muy grande.
- `NW-BCAST-002`: subred grande.
- `NW-BCAST-003`: subred mediana-grande.
- `NW-BCAST-004`: demasiados endpoints previstos/encontrados.
- `NW-BCAST-005`: endpoints numerosos.
- `NW-BCAST-020`: muchos dispositivos IoT.
- `NW-BCAST-021`: muchas cámaras.
- `NW-BCAST-022`: voz/telefonía numerosa.
- `NW-BCAST-023`: IoT/cámaras mezclados en VLAN no especializada.
- `NW-BCAST-030`: trunks abiertos transportando todas las VLANs.
- `NW-BCAST-031`: VLAN presente en muchos trunks.

## UI

Se añade una tarjeta en el dashboard:

- **📡 Riesgo broadcast**
- Botón **Auditar broadcast**

## Limitación importante

La auditoría no mide tráfico real. No sustituye a NetFlow, SPAN, telemetría del switch o contadores de broadcast/multicast. Sirve como indicador preventivo de diseño.

## Comprobaciones

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_24_broadcast_domains.zip
```
