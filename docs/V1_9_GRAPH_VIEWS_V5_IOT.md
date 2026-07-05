# NetWizard v1.9 · Graph Views + V5 IoT

## Objetivo

Esta versión reorganiza las representaciones gráficas para que no estén dispersas dentro de Configuración & Export.

## Cambios

- Nueva sección lateral: **Vistas gráficas**.
- V5 pasa a ser la vista visual principal.
- Topología física queda como vista dedicada a cableado, enlaces y trunks.
- Auditoría unificada queda como vista de comprobación global NetWizard + IoT.
- V5 añade filtros por tipo de dispositivo y tecnología.
- V5 muestra infraestructura IoT y dispositivos IoT finales sobre el mismo mapa.
- V5 dibuja enlaces inalámbricos con leyenda diferenciada: Wi‑Fi, LoRaWAN, Zigbee, Thread, MQTT, BLE y Ethernet.
- Configuración & Export queda más centrada en generación de configuración, DHCP, VTP, exportación y outputs.

## Filosofía

Las vistas ya no deben aportar “lo mismo con otro dibujo”:

- **V5 principal:** edición visual y operación sobre objetos de red + IoT.
- **Topología física:** validación rápida de cableado, puertos y enlaces tradicionales.
- **Auditoría unificada:** grafo filtrable para revisar composición global, nodos y enlaces.

## Limitaciones actuales

- Los nodos IoT en V5 se dibujan como capa visual encima de la V5 existente.
- El drag/drop directo de nodos IoT en V5 aún no persiste posición propia.
- La edición completa de IoT se abre desde el módulo IoT embebido.

## Siguiente paso sugerido

Convertir la V5 en motor único persistente para posiciones de red e IoT, de forma que los nodos IoT también se puedan recolocar mediante drag/drop y guardar sus coordenadas visuales.
