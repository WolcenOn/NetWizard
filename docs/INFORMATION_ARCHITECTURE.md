# Arquitectura de información de NetWizard

## Objetivo

La navegación debe seguir la intención del operador. Una pantalla no debe convertirse en destino genérico de módulos porque tenga espacio disponible.

## Áreas canónicas

### Diseñar / documentar

Las pantallas de dominio siguen siendo la autoridad de edición:

- Ubicaciones
- Dispositivos
- Inventario físico
- Puertos & Interfaces
- Enlaces
- Circuitos WAN dentro de Enlaces
- VLANs & Subnets
- Hosts & IP Map
- IoT & Gateways
- Firewall & Seguridad

Los datos se corrigen en estas pantallas o en el editor específico de su dominio. Los paneles derivados no crean una segunda autoridad.

**Circuitos WAN** se editan en Enlaces porque representan conectividad externa terminada en un dispositivo/puerto. La tarjeta WAN de Validación es únicamente una lectura derivada de `wanCircuits` y sus incidencias. El tránsito L3 inter-sede no crea otra colección: se modela con dos `ports` routed unidos por un `link`; `wanCircuits` sigue describiendo el servicio/circuito WAN y `routing` decide cómo se alcanzan los prefijos remotos.

**HA / routing services por dispositivo** se editan en Dispositivos sobre `highAvailability.devices[deviceId]`. La intención incluye DHCP relay, rutas por defecto, tracking/IP-SLA y grupos HSRP/VRRP, y alimenta directamente el Private Engine sin crear otra autoridad.

**Routing estático inter-sede** también se edita en Dispositivos, pero sobre la autoridad `routing.staticRoutesByDevice[deviceId]`. Solo contiene prefijos remotos explícitos, next-hop y distancia administrativa. Las rutas por defecto permanecen en `highAvailability` para no duplicar responsabilidades. El plan neutral combina rutas explícitas válidas con inferencias de vecinos directos y el Private Engine bloquea `apply-ready` cuando una ruta explícita tiene un next-hop no alcanzable directamente.

En **VLANs & Subnets** se editan también las intenciones L2/L3 directamente ligadas a las VLANs: DHCP por VLAN, Router-on-a-Stick y VTP Cisco. Estas opciones alimentan la generación posterior y por tanto deben completarse antes de Validación/Despliegue; no son artefactos de exportación. La evidencia VTP de producción no duplica esa intención: se registra como estado `Observed` bajo `observedState.vtpDevices[deviceId]` y el Private Engine la contrasta con `vtp` antes de certificar `apply-ready`.

### Visualizar

**V5 principal** es el mapa operativo/editable de Red + IoT.

**Topología física** sirve para comprobar enlaces, puertos, trunks y cableado tradicional.

No se mantienen varias visualizaciones globales que representen lo mismo con otro dibujo. Los prototipos `netwizard-graph-viewer.js` y `netwizard-unified-config-map.js` quedan fuera del entrypoint normal.

`NetWizardBridge` puede permanecer como API interna de compatibilidad para IoT e integraciones, sin exponer herramientas de depuración al usuario.

### Validar & analizar

`pg-validate` reúne resultados derivados previos al despliegue:

- compatibilidad/capacidades de plataforma;
- resiliencia y HA;
- circuitos WAN;
- capacidad de tráfico;
- servicios internos;
- planificación Wi-Fi;
- IPv6/VRF;
- simulación de fallos;
- estado observado, drift y candidato incremental.

Estos paneles son análisis, no colecciones paralelas ni una nueva fuente de verdad.

Estado funcional actual:
- WAN ya tiene editor canónico en Enlaces.
- HA/routing services por dispositivo ya tiene editor canónico en Dispositivos sobre `highAvailability.devices[deviceId]`.
- capacidad de tráfico, servicios internos, Wi-Fi planning, IPv6/VRF y escenarios de fallo siguen siendo análisis de datos existentes/importados; permanecen condicionales hasta disponer de un editor conectado a su dominio natural.
- la topología de resiliencia (`stacks`, `mlagDomains`, `haGroups`, `diversityPolicies`) sigue siendo validación condicional y no debe presentarse como asistente de configuración.

Si un análisis necesita edición real en el futuro, debe recibir una superficie de edición en su dominio natural antes de promocionarse a flujo principal.

### Desplegar

`pg-cfg` es **Despliegue & Exportación**.

Su responsabilidad es:

- generar configuraciones server-side;
- mostrar readiness por dispositivo;
- inspeccionar artefactos privados;
- preparar incremental/rollback cuando exista evidencia observada;
- ejecutar Production Gate;
- exportar paquetes y artefactos vigentes.

No debe alojar mapas experimentales ni paneles genéricos de análisis.

## Experimentos retirados de la UX

Se retiran del entrypoint normal:

- `netwizard-bridge-ui.js`;
- `netwizard-graph-viewer.js`;
- `netwizard-unified-config-map.js`;
- botones `Vista IoT-ready` y `Grafo unificado`.

Los tres prototipos retirados ya no forman parte del repositorio ejecutable. La documentación histórica puede conservar referencias a ellos, pero no deben reaparecer como módulos cargables ni como dependencias de V5.

## Regla para módulos nuevos

Antes de añadir una tarjeta o módulo visible, debe poder responder a una de estas preguntas:

1. ¿Dónde edita el usuario la fuente canónica?
2. ¿Es una visualización, validación o acción de despliegue?
3. ¿Qué decisión permite tomar?
4. ¿Qué pasa si está vacío o no configurado?
5. ¿Duplica una vista o análisis que ya existe?

Si no tiene una respuesta clara, el módulo no debe entrar en la navegación principal.
