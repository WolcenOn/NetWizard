# NetWizard Safe Refactor v1.4

## Objetivo
Mejorar la calidad del bridge NetWizard → IoTWizard sin tocar la lógica principal de NetWizard.

## Cambios
- Bridge actualizado a `netwizard-bridge-v1.4`.
- Resuelve enlaces físicos que usan `aPortId` / `bPortId`.
- Añade enlace adicional `physical_device_path` entre dispositivos padre de los puertos conectados.
- Normaliza VLAN separando:
  - `vlanRef`: identificador interno de NetWizard.
  - `vlanId` / `vlanNumber`: número real de VLAN.
- Detecta `portRef` en hosts, además de `portId`, `port` y `connectedPortId`.
- Rellena `connectedDeviceId` del host desde `connectedDeviceId`, `connDev`, `deviceId` o desde el puerto asociado.
- Añade `warnings` al grafo para preparar validaciones cruzadas con IoTWizard.
- Añade `validateUnifiedGraph()` al API del bridge.

## No cambia
- No modifica `js/netwizard.js`.
- No cambia formularios ni renderizados.
- No sustituye mapas existentes.
- No modifica el proyecto salvo al guardar/exportar snapshot bajo demanda.
