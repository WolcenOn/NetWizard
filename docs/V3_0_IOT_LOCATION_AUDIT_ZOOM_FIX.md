# NetWizard v3.0 · IoT location + auditoría estable

## Objetivo

Corregir dos problemas detectados en la v2.9:

1. Las ubicaciones de NetWizard no aparecían en los selectores de dispositivos IoT.
2. La Auditoría Unificada se reordenaba o perdía el layout manual al hacer zoom o interactuar con el canvas.

## Cambios

### Ubicaciones IoT

`netwizard-iot-embedded.js` ya no depende de `window.S`, porque el estado principal de NetWizard se declara con `let S` y no siempre está expuesto como propiedad global. Ahora la lectura de ubicaciones se hace con prioridad:

1. `NetWizardBridge.getProjectSnapshot().project.physicalLocations`
2. `localStorage['nwp_v4'].physicalLocations`
3. `localStorage['nwp_v4'].hostPhysicalLocations` como fallback legacy
4. `window.S.physicalLocations` solo si existe

Esto mantiene compatibilidad con proyectos antiguos y permite poblar los campos `locationId`, `physicalLocation` y `locationRole` en infraestructura y dispositivos IoT.

### Auditoría Unificada

La Auditoría Unificada tiene ahora una vista propia persistente:

- `netwizard_unified_view_v30` para pan/zoom.
- `netwizard_unified_manual_positions_v29` para posiciones manuales.

El zoom ya no dispara el render original que reordenaba los nodos. El módulo intercepta `wheel`, `mousedown`, `mousemove` y `click` en fase capture, transforma coordenadas del canvas correctamente y mantiene el layout estable tras ordenar.

### Layout por ubicación

El layout de Auditoría Unificada agrupa nodos por ubicación cuando exista `locationId` o `physicalLocation` en el nodo/ref. Dentro de cada bloque:

- red a la izquierda,
- infraestructura IoT en columna central,
- hosts/endpoints a la derecha,
- dispositivos IoT al extremo derecho.

## Pruebas recomendadas

1. Crear ubicaciones en NetWizard.
2. Editar infraestructura IoT y verificar que el selector muestra las ubicaciones.
3. Editar un dispositivo IoT y asignarle ubicación.
4. Abrir Auditoría Unificada, ordenar, hacer zoom y pan.
5. Arrastrar nodos manualmente y comprobar que no se desordenan al hacer zoom.
