# NetWizard v2.4 · V5 Drag & IoT Links Fix

## Objetivo
Corregir tres comportamientos detectados en la V5:

1. Las ubicaciones crecían durante el drag de hosts/equipos, dificultando sacar objetos de una ubicación.
2. Los nodos IoT dibujados por la capa IoT de V5 no eran arrastrables.
3. Algunos dispositivos IoT Wi‑Fi sin access node explícito no mostraban enlace al router/AP Wi‑Fi de NetWizard.

## Cambios aplicados

### Congelación temporal de bounds durante drag
Durante el arrastre de hosts/equipos se congelan los bounds calculados de las ubicaciones. La ubicación vuelve a recalcularse al soltar el objeto.

Esto evita que una ubicación "persiga" al host mientras se intenta sacarlo.

### Drag de nodos IoT
La extensión IoT de V5 ahora captura pointer events sobre nodos IoT antes de que el motor base procese el canvas. Los cambios de posición se guardan en:

```js
S.visual.iotPos.access
S.visual.iotPos.devices
```

No se modifica todavía el modelo funcional de IoT; solo la posición visual en V5.

### Enlace Wi‑Fi fallback
Si un dispositivo IoT Wi‑Fi no tiene access node asignado, V5 busca un router/AP Wi‑Fi de NetWizard y dibuja un enlace lógico como fallback visual.

## Pendiente
- Permitir que al arrastrar un nodo IoT sobre un router/AP se reasigne su access node.
- Integrar posiciones IoT con ubicaciones físicas de forma formal.
- Añadir tooltip específico para enlaces IoT.
