# NetWizard v3.23 · Inventario, documentación y matriz de conectividad

Esta versión añade una capa de documentación exportable y revisión de conectividad sin modificar el modelo principal ni los automatismos existentes.

## Nuevas capacidades

### Inventario CSV

La nueva tarjeta del dashboard permite descargar un CSV con filas normalizadas para:

- Dispositivos.
- Puertos.
- Enlaces físicos.
- VLANs.
- Hosts.
- Scopes DHCP.
- Reglas firewall/ACL.

El CSV usa columnas comunes para facilitar filtrado en hojas de cálculo: sección, clave, nombre, tipo, VLAN, dispositivo, puerto, IP, CIDR, gateway, modo, acción, origen, destino, servicio, notas y extra.

### Documentación Markdown

También se puede descargar un documento Markdown con:

- Resumen del proyecto.
- Inventario por secciones.
- VLANs/subnets/gateways.
- Cableado y enlaces.
- DHCP.
- Firewall.
- Matriz de conectividad.

El objetivo es generar una base editable para documentación técnica o revisión con terceros.

### Matriz de conectividad

La matriz cruza VLAN origen contra VLAN destino e Internet/WAN. La decisión se calcula de forma prudente usando:

- Matriz inter-VLAN manual si existe.
- Reglas firewall explícitas cuando coinciden con origen/destino.
- Intención de VLAN: invitados, IoT, cámaras, DMZ, gestión, usuarios, etc.
- Recomendación `REVIEW` cuando no hay suficiente información.

No pretende sustituir una revisión de seguridad; sirve para detectar huecos de diseño antes de exportar configuraciones.

## Archivos añadidos

- `js/netwizard-documentation-utils.js`
- `docs/V3_23_INVENTORY_CONNECTIVITY_MATRIX.md`

## Tests

Se añaden pruebas para:

- Inventario exportable.
- CSV.
- Matriz de conectividad prudente.
- Documento Markdown con secciones principales.

Comandos validados:

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_23_inventory_connectivity_matrix.zip
```

## Limitaciones conocidas

- La matriz no interpreta todavía todas las variantes posibles de reglas vendor-specific.
- Las filas `REVIEW`, `ALLOW/REVIEW` y `DENY/REVIEW` requieren validación humana.
- El Markdown es documentación base; no sustituye un informe formal con firma/revisión.
