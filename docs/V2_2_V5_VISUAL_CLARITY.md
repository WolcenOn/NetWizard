# NetWizard v2.2 · V5 Visual Clarity

## Objetivo

Mejorar la legibilidad de la V5 cuando hay muchos hosts dentro de una misma ubicación.

## Cambios

- Los hosts se dibujan en formato compacto.
- Se reduce el tamaño base de las tarjetas de host en V5.
- Las etiquetas permanentes de enlace host → equipo se sustituyen por puntos de conexión.
- Al pasar el ratón por un punto de conexión se muestra un tooltip con:
  - host,
  - equipo conectado,
  - puerto,
  - modo del puerto,
  - VLAN del host,
  - VLAN configurada en el puerto,
  - IP efectiva.
- El punto cambia de color según el estado:
  - verde: puerto asignado y VLAN coincidente,
  - rojo: puerto asignado pero VLAN no coincide,
  - ámbar: conexión pendiente/sin puerto.

## No cambia

- No modifica la lógica de autoasignación.
- No cambia la generación de configuración.
- No cambia los datos guardados del proyecto.
- No cambia la V5 IoT ni la topología clásica.

## Siguiente mejora recomendada

Añadir modos de densidad en V5:

- Vista detallada.
- Vista compacta.
- Vista solo iconos.

También conviene añadir agrupación automática de hosts cuando haya muchos dispositivos en una misma ubicación.
