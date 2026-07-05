# V1.8 · Unified Config Map

Esta versión acerca NetWizard a la versión definitiva con una vista de configuración común para red tradicional + IoT.

## Añadido

- Nuevo script `js/netwizard-unified-config-map.js`.
- Nueva tarjeta en `Configuración & Export`: **Mapa único de configuración · Red + IoT**.
- El mapa mezcla el grafo NetWizard con la capa IoT embebida.
- Filtros por red, switch, router, firewall, hosts, puertos, infraestructura IoT, dispositivos IoT y tecnologías: Wi‑Fi, LoRaWAN, Zigbee, Thread, MQTT y cámara.
- Click en nodos IoT para editar directamente infraestructura o dispositivo final.
- Pan/zoom persistente del mapa.

## No cambia

- No sustituye todavía la topología clásica ni la Vista Visual V5.
- No reescribe `netwizard.js`.
- No elimina el módulo IoT embebido; lo usa como fuente de datos.

## Prueba recomendada

1. Crea VLANs, switches y puertos.
2. Abre `IoT & Gateways` y crea un AP/gateway y varios IoT.
3. Ve a `Configuración & Export`.
4. Usa el nuevo mapa único.
5. Filtra por tecnologías.
6. Haz clic en nodos IoT y edita desde el panel lateral.
