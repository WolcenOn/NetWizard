# NetWizard v1.7 - IoT embebido y mapa unificado

Esta versión transforma la integración de dos páginas separadas en una primera integración dentro de la página principal de NetWizard.

## Añadido

- Nueva sección de menú: **IoT & Gateways**.
- Nuevo módulo `js/netwizard-iot-embedded.js`.
- Nuevo estado local `nw_iot_embedded_v1` para la capa IoT embebida.
- Gestión de infraestructura IoT:
  - Access Point Wi-Fi.
  - Gateway LoRaWAN.
  - Coordinador Zigbee.
  - Thread Border Router.
  - Gateway BLE.
  - Broker MQTT.
  - Home Assistant/controlador.
  - NVR/VMS.
  - Cloud/API platform.
- Gestión de dispositivos IoT finales.
- Asociación de infraestructura IoT a switch/puerto/VLAN del grafo NetWizard.
- Asociación de dispositivos IoT a infraestructura IoT.
- Mapa unificado NetWizard + IoT con filtros:
  - Red.
  - Puertos.
  - Accesos IoT.
  - Dispositivos IoT.
  - Wi-Fi.
  - LoRaWAN.
  - Zigbee.
  - Thread.
  - MQTT.
- Click en nodos del mapa para inspeccionar y editar infraestructura/dispositivos IoT.
- Plan de configuración IoT integrado y copiable.

## No cambiado

- No se modifica la lógica central de NetWizard.
- No se reemplaza la topología clásica ni la Vista V5.
- No se elimina la integración por localStorage anterior.
- No se cambia el export/import original de NetWizard.

## Próximo paso recomendado

- Unificar el mapa de configuración de `pg-cfg` y el mapa IoT para que ambos usen el mismo canvas y el mismo motor de layout.
- Añadir filtros globales en la topología principal.
- Exportar configuración IoT por vendor: UniFi, Huawei, Galgus, LoRaWAN generic, Zigbee2MQTT, Home Assistant, MQTT.
