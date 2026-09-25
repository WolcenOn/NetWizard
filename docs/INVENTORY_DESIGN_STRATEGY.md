# Inventory, Design and Custom Device Strategy

## Objetivo

NetWizard debe soportar dos tipos de trabajo claramente distintos sin duplicar el modelo de proyecto:

1. **Inventario / As-Built**: documentar lo que existe físicamente en una instalación.
2. **Diseño / To-Be**: plantear una red nueva o una evolución de la existente.

Ambos flujos comparten entidades físicas y lógicas (equipos, puertos, racks, enlaces, cableado, alimentación, VLANs, etc.), pero cambian la intención, los validadores y las exportaciones esperadas.

También debe ser posible definir **equipos personalizados por proyecto** cuando un modelo no exista en el catálogo global.

---

## 1. Modo Inventario

### Propósito

Registrar de forma descriptiva el estado encontrado en campo:

- sedes y ubicaciones;
- salas técnicas;
- racks;
- unidades de rack ocupadas;
- equipos;
- marca y modelo;
- número de serie/asset tag opcional;
- fuentes de alimentación;
- consumo observado o nominal;
- PDUs y tomas;
- puertos físicos;
- tipo de puerto;
- velocidad máxima;
- velocidad negociada observada;
- transceptores;
- enlaces;
- patch panels;
- tomas;
- cableado;
- recorrido físico;
- VLAN/IP cuando pueda observarse;
- configuración capturada cuando exista.

El objetivo del modo Inventario **no es demostrar que la red está lista para desplegarse**.

Por tanto, no debe reutilizar la Production Gate como condición de éxito.

### Gate de inventario

Se añadirá un `Inventory Gate` separado para comprobar consistencia documental, por ejemplo:

- rack referenciado existe;
- unidades no colisionan;
- puertos enlazados existen;
- un puerto físico no tiene enlaces incompatibles;
- PDU/toma existe;
- velocidades observadas no superan la capacidad del puerto;
- transceptor compatible cuando sea aplicable;
- cableado no referencia elementos inexistentes;
- identificadores físicos duplicados;
- advertencias por datos importantes ausentes.

Un inventario podrá ser válido aunque:

- no tenga plan IP;
- no tenga DHCP;
- no tenga routing;
- no tenga políticas firewall;
- no tenga deployment plan.

### Exportaciones de inventario

El modo Inventario priorizará:

- informe As-Built;
- inventario CSV/XLSX futuro;
- rack elevations;
- BOM/listado de equipos;
- mapa de conexiones;
- matriz de puertos;
- cable schedule;
- alimentación/PDU;
- documentación fotográfica futura;
- JSON portable NetWizard.

No debe ofrecer un deployment ZIP como resultado principal si no existe un diseño deseado.

---

## 2. Modo Diseño

### Propósito

Representar el estado deseado de una red nueva o modificada:

- arquitectura;
- dispositivos;
- capacidad;
- VLANs;
- direccionamiento;
- DHCP;
- routing;
- firewall;
- switching;
- HA;
- management;
- Wi-Fi;
- enlaces;
- racks;
- energía;
- cableado;
- deployment.

Este modo sí usa:

- Production Gate;
- generación vendor;
- Private Engine;
- deployment bundle;
- runbook;
- change set;
- validación de capacidad y arquitectura.

### Golden paths

Las plantillas certificadas del Asistente pertenecen al modo Diseño.

Una plantilla marcada como certificada debe seguir pasando CI de extremo a extremo.

---

## 3. Inventario -> Diseño

Una necesidad importante es poder visitar una instalación y después usar ese inventario como base de una renovación.

La conversión debe ser explícita:

```text
Inventario As-Built
        |
        | crear diseño desde inventario
        v
Diseño To-Be
```

No se debe modificar silenciosamente el inventario original.

La operación debería:

1. crear una nueva revisión/proyecto de diseño;
2. copiar las entidades físicas relevantes;
3. conservar referencias a su origen;
4. permitir marcar equipos como:
   - conservar;
   - retirar;
   - sustituir;
   - añadir;
5. permitir comparar As-Built vs To-Be.

Esto habilita en el futuro informes de:

- altas;
- bajas;
- cambios;
- reutilización;
- impacto;
- coste/BOM diferencial.

---

## 4. Modelo de datos: no duplicar dispositivos

No se crearán estructuras independientes como `inventoryDevices` y `designDevices`.

Se mantendrán las colecciones canónicas existentes:

- `devices`;
- `ports`;
- `links`;
- `racks`;
- `pdus`;
- `powerConnections`;
- `patchPanels`;
- `cableRuns`;
- etc.

El proyecto tendrá una intención de workflow explícita, por ejemplo:

```json
{
  "workflow": {
    "mode": "inventory"
  }
}
```

o:

```json
{
  "workflow": {
    "mode": "design"
  }
}
```

La UI, gates y exportaciones se adaptarán al modo.

Se estudiará un tercer estado `hybrid` solo si aparece una necesidad real; no se añadirá por anticipado.

---

## 5. Estado observado vs deseado

NetWizard ya dispone de `observedState` para configuraciones capturadas y drift.

La estrategia será:

- **workflow inventory** describe principalmente el estado observado;
- **workflow design** describe principalmente el estado deseado;
- `observedState` sigue siendo evidencia capturada, no un segundo proyecto completo.

No se intentará meter todo el inventario físico dentro de `observedState`.

Los objetos físicos canónicos seguirán en el proyecto para poder renderizarlos, exportarlos y reutilizarlos.

---

## 6. Catálogo global vs modelos personalizados

### Catálogo global

NetWizard puede contener modelos conocidos y mantenidos por el producto:

```text
Cisco ISR ...
UniFi ...
Fortinet ...
...
```

Este catálogo sirve para:

- autocompletar;
- aplicar capacidades;
- crear puertos;
- sugerir consumo;
- validar compatibilidad.

No debe ser obligatorio que un equipo exista en ese catálogo.

### Catálogo local del proyecto

Cada proyecto podrá definir modelos propios, por ejemplo:

```json
{
  "customDeviceModels": [
    {
      "id": "custom-acme-x48p",
      "manufacturer": "ACME",
      "model": "X48P",
      "kind": "switch",
      "rackUnits": 1,
      "weightKg": 4.8,
      "powerDrawWatts": 82,
      "powerMaxWatts": 370,
      "poeBudgetWatts": 240,
      "ports": [
        {
          "namePattern": "Gi1/0/{n}",
          "count": 48,
          "media": "copper",
          "speedMaxMbps": 1000,
          "poeCapable": true
        },
        {
          "namePattern": "SFP+{n}",
          "count": 4,
          "media": "sfp+",
          "speedMaxMbps": 10000
        }
      ]
    }
  ]
}
```

Este objeto será:

- portable con el proyecto;
- editable;
- versionable;
- independiente del catálogo global;
- usable offline;
- validado por schema.

### Instancia vs modelo

Debe existir una distinción clara:

**Modelo**

```text
Cisco C9300-48P
48 puertos
1U
PoE budget X
consumo nominal Y
```

**Instancia**

```text
SW-PLANTA-1
serial ABC123
rack R1
U20
IP 10.0.0.10
```

Varias instancias pueden referenciar el mismo modelo.

Un dispositivo podrá usar:

- modelo global;
- modelo personalizado del proyecto;
- modo totalmente manual/genérico.

---

## 7. Campos propuestos para modelos personalizados

### Identidad

- fabricante;
- modelo;
- SKU/part number;
- revisión;
- categoría/kind;
- notas.

### Físico

- altura U;
- ancho/profundidad;
- peso;
- montaje;
- orientación.

### Alimentación

- consumo típico;
- consumo máximo;
- número de PSU;
- PSU redundantes;
- voltaje;
- PoE budget;
- calor estimado opcional.

### Puertos

Por grupo:

- cantidad;
- patrón de nombre;
- tipo/media;
- velocidad máxima;
- velocidades soportadas;
- duplex;
- PoE;
- capacidad breakout futura;
- slot/módulo opcional.

### Capacidades

- L2/L3;
- routing;
- firewall;
- Wi-Fi;
- HA;
- stacking;
- MLAG;
- VRF;
- PoE;
- management;
- vendor OS cuando aplique.

No todos los campos serán obligatorios.

---

## 8. Editor de modelos personalizados

La UI futura debería ofrecer:

```text
Añadir equipo
  |
  +-- Buscar catálogo global
  |
  +-- Usar modelo personalizado existente
  |
  +-- Crear modelo personalizado
  |
  +-- Equipo genérico/manual
```

El editor de modelo debe permitir:

- duplicar un modelo global como punto de partida;
- cambiar fabricante/modelo;
- definir consumo;
- definir dimensiones;
- crear grupos de puertos;
- editar velocidades;
- indicar PoE;
- definir capacidades;
- guardar solo en el proyecto.

No se modificará el catálogo global desde un proyecto normal.

En el futuro podrá existir una acción administrativa separada para promover un modelo local validado al catálogo global del producto.

---

## 9. UX de selección inicial

Al crear un proyecto, NetWizard debería preguntar primero:

```text
¿Qué quieres hacer?

[ Inventariar una red existente ]
Documentar racks, equipos, puertos, cableado y conexiones.

[ Diseñar una red ]
Crear una arquitectura nueva y preparar configuración/deployment.
```

### Inventario

La navegación prioriza:

1. ubicaciones;
2. racks;
3. equipos;
4. alimentación;
5. puertos;
6. conexiones;
7. cableado;
8. datos lógicos observados;
9. informe As-Built.

### Diseño

La navegación prioriza:

1. asistente/preset;
2. arquitectura;
3. dispositivos;
4. VLAN/IP;
5. enlaces;
6. seguridad;
7. validación;
8. producción/exportación.

---

## 10. Relación con Client Engine / Private Engine

El inventariado es principalmente Client Engine:

- captura;
- edición;
- visualización;
- rack elevation;
- conexiones;
- catálogo local.

Puede funcionar offline.

El diseño avanzado utiliza Client Engine para interacción y Private Engine para algoritmos propietarios:

- routing;
- generation;
- validation avanzada;
- deployment.

Esto mantiene la arquitectura ya aprobada.

---

## 11. Estrategia de implementación

### Fase I1 — Contrato de workflow

- añadir `workflow.mode = inventory | design`;
- migración compatible de proyectos antiguos a `design`;
- schema y sanitización;
- tests.

### Fase I2 — Catálogo personalizado

- añadir `customDeviceModels`;
- contrato de modelo;
- resolución global/local/manual;
- tests de normalización y referencias.

### Fase I3 — Editor de modelo

- UI para crear/editar modelo local;
- grupos de puertos;
- consumo/rack/PoE;
- crear puertos de una instancia desde el modelo.

### Fase I4 — Experiencia Inventario

- selector inicial;
- navegación orientada a campo;
- Inventory Gate;
- informe As-Built;
- exportación de inventario.

### Fase I5 — Inventario a Diseño

- clonar inventario;
- estado keep/remove/replace/add;
- comparación;
- BOM diferencial.

---

## 12. Reglas de compatibilidad

- los proyectos 3.50 existentes deben seguir abriendo;
- si no existe `workflow.mode`, se interpretan como `design`;
- un modelo personalizado debe viajar en export/import;
- eliminar un modelo local no puede dejar instancias corruptas sin aviso;
- cambiar un modelo no debe sobrescribir automáticamente personalizaciones explícitas de una instancia;
- una instancia debe conservar un snapshot mínimo de propiedades relevantes si su modelo deja de estar disponible.

---

## Resultado esperado

NetWizard podrá servir tanto para:

**Trabajo de campo / documentación**

```text
Voy a una empresa
-> fotografío/documento rack
-> registro equipos
-> registro puertos
-> registro cables
-> registro alimentación
-> genero As-Built
```

como para:

**Ingeniería / diseño**

```text
Creo arquitectura
-> dimensiono
-> valido
-> genero configuraciones
-> genero deployment
```

y ambos mundos podrán conectarse mediante:

```text
As-Built -> To-Be -> Change Set
```

sin mezclar sus criterios de calidad.
