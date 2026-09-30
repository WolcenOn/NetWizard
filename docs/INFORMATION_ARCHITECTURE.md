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
- VLANs & Subnets
- Hosts & IP Map
- IoT & Gateways
- Firewall & Seguridad

Los datos se corrigen en estas pantallas o en el editor específico de su dominio. Los paneles derivados no crean una segunda autoridad.

En **VLANs & Subnets** se editan también las intenciones L2/L3 directamente ligadas a las VLANs: DHCP por VLAN, Router-on-a-Stick y VTP Cisco. Estas opciones alimentan la generación posterior y por tanto deben completarse antes de Validación/Despliegue; no son artefactos de exportación.

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

Los archivos pueden conservarse temporalmente como referencia histórica mientras no formen parte del loader normal. Una limpieza posterior puede eliminarlos físicamente cuando sus dependencias y valor residual sean cero.

## Regla para módulos nuevos

Antes de añadir una tarjeta o módulo visible, debe poder responder a una de estas preguntas:

1. ¿Dónde edita el usuario la fuente canónica?
2. ¿Es una visualización, validación o acción de despliegue?
3. ¿Qué decisión permite tomar?
4. ¿Qué pasa si está vacío o no configurado?
5. ¿Duplica una vista o análisis que ya existe?

Si no tiene una respuesta clara, el módulo no debe entrar en la navegación principal.
