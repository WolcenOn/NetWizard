# NetWizard v2.7 · Layout Manager

## Objetivo

Mejorar la legibilidad de V5 y de la Auditoría Unificada con algoritmos de ordenación seleccionables.

## Cambios principales

- Nuevo selector de layout en V5.
- Nuevo selector de layout en Auditoría Unificada.
- Modo recomendado: `Por ubicación · columnas`.
- Las ubicaciones se colocan en una rejilla sin solaparse.
- Dentro de cada ubicación:
  - routers/firewalls/switches quedan a la izquierda;
  - hosts quedan a la derecha;
  - se usan varias columnas de hosts si hay muchos.
- Modos adicionales:
  - Jerárquico.
  - Radial por ubicación.
  - Fuerzas suave.

## Motivo técnico

V5 representa un grafo compuesto: ubicaciones como contenedores, equipos de red, hosts, infraestructura IoT y enlaces. Para evitar cruces y solapes, el layout por ubicación usa separación por columnas y cálculo de tamaño de contenedor antes de posicionar nodos.

## Próximos pasos

- Routing ortogonal de enlaces.
- Bundling de enlaces paralelos entre switches.
- Guardar layouts como vistas predefinidas.
