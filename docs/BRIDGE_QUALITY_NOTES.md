# Bridge Quality Notes

El JSON de v1.3 ya demostraba que el bridge estaba leyendo correctamente dispositivos, VLANs, hosts, puertos y enlaces, pero había varios puntos a corregir antes de integrarlo con IoTWizard:

1. Los enlaces físicos salían con `from` y `to` vacíos cuando NetWizard guardaba `aPortId` y `bPortId`.
2. La VLAN exportaba el identificador interno como `vlanId`; ahora `vlanRef` conserva el ID interno y `vlanId`/`vlanNumber` representan el tag real.
3. Algunos hosts tenían `portRef` y `connectedDeviceId` dentro del modelo original; ahora se leen ambos.
4. El grafo añade avisos (`warnings`) para detectar datos incompletos sin bloquear la exportación.

Esta versión sigue siendo de solo lectura y compatible con la integración futura de IoTWizard.
