# NetWizard v2.1 · Autoasignación y navegación V5

## Objetivo

Esta versión corrige dos puntos detectados en la V5:

1. Restaurar navegación del canvas: pan con arrastre sobre fondo y zoom con rueda.
2. Autoasignar hosts a un puerto libre compatible al moverlos entre ubicaciones.

## Autoasignación host → puerto

Al mover un host a otra ubicación en V5:

- Se actualiza la ubicación visual del host.
- Se sincroniza `host.physicalLocation` con la ubicación destino.
- Si el host está en modo `auto`, se buscan dispositivos conectables en la misma ubicación.
- Se priorizan switches, puertos libres, puertos access y puertos sin VLAN previa.
- El puerto elegido se configura como `access`.
- El puerto adopta la `accessVlanRef` del host.
- El host queda enlazado a `connectedDeviceId` y `portRef`.

Si el host está en modo manual, no se modifica su puerto.

## Navegación V5

- Arrastrar sobre fondo: mover canvas.
- Rueda del ratón: zoom centrado en el cursor.
- Botón Fit: reencuadra la vista.

## Próximo paso

Añadir un panel de previsualización antes de aplicar la autoasignación masiva:

- Host destino.
- Puerto sugerido.
- VLAN que se aplicará.
- Cambios de configuración que se generarían.
