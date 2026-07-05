# NetWizard v3.9 · Modo producción y auditoría normalizada

Esta versión añade una primera capa común para acercar NetWizard a un uso más controlado:

- `js/netwizard-audit.js` centraliza severidades, códigos de auditoría y modo demo/producción.
- El dashboard muestra una tarjeta de **Modo de ejecución**.
- La auditoría de preparación devuelve incidencias con códigos como `NW-VLAN-001`, `NW-L3-001`, `NW-IP-004` y `NW-DHCP-001`.
- En modo producción, determinados avisos críticos se elevan a error bloqueante.
- La exportación de configuraciones queda bloqueada en modo producción si la auditoría detecta errores.

## Modos

- **Demo / formación**: permite diseñar aunque falten datos.
- **Producción**: bloquea exportación de configuraciones si hay errores o avisos críticos elevados.

## Límites conocidos

El modo producción todavía no significa que el proyecto esté certificado para uso real. Quedan pendientes políticas completas por VLAN, DHCP avanzado, firewall/ACL desde intención, más pruebas E2E reales y revisión completa de todos los generadores vendor.
