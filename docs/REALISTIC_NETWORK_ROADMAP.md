# NetWizard — hoja de ruta hacia diseño de red realista

## Objetivo

Evolucionar NetWizard desde un diseñador/generador de configuraciones hacia una herramienta utilizable por ingeniería e instalación de redes: diseño físico y lógico, conectividad entre sedes, validación de intención, generación privada autoritativa, puesta en producción y, más adelante, presupuesto/BOM.

Principios:

- conservar una sola autoridad canónica por concepto;
- separar To-Be, Observed y Derived;
- mantener compatibilidad con proyectos 3.50 existentes salvo cambio de formato estrictamente necesario;
- generar vendor CLI únicamente en Private Engine en producción;
- no declarar `apply-ready` sin evidencia suficiente;
- cada bloque funcional debe terminar con tests y una PR independiente.

## Fase 0 — Golden production realmente resoluble

### 0.1 Verificación VTP observada

Problema actual: VTP activo fuerza `review-required`, pero el usuario no puede aportar la verificación que pide el gate.

Implementar:

- mantener `project.vtp` como To-Be;
- reutilizar `project.observedState` para evidencia observada por switch;
- registrar versión, dominio, modo, revision number, primary VTPv3, conflictos y contadores de error;
- comparar deseado ↔ observado;
- permitir `apply-ready` cuando la evidencia es coherente;
- mantener bloqueo si falta evidencia, hay mismatch, conflictos, errores o no existe un primary VTPv3 único cuando es necesario;
- no almacenar contraseñas observadas.

Criterio de salida: un escenario Cisco limpio puede pasar legítimamente de `review-required` a `apply-ready`.

### 0.2 Golden example de cuatro sedes

Actualizar/crear un ejemplo de referencia que pueda completar todo el flujo:

Design → Validation → Private Engine → Production Gate LISTO.

El ejemplo debe evitar warnings artificiales y documentar qué evidencia observada se supone validada. Mientras todavía no exista transporte L3 inter-sede canónico, las VLANs permanecen locales por sede y el sample usa VTP transparent con evidencia observada coherente; no simula un dominio L2 extendido entre sedes.

## Fase 1 — Fundamentos de conectividad inter-sede

Modelar una WAN corporativa real sin extender VLANs entre sedes.

- reutilizar `devices`, `ports`, `links` y `wanCircuits`;
- distinguir acceso a Internet de transporte corporativo;
- soportar routers/firewalls edge por sede;
- modelar interfaces y redes de tránsito L3;
- representar enlaces privados/MPLS/Ethernet y overlays VPN sin duplicar la topología física;
- auditar la autoridad `routing` existente antes de crear nuevos campos.

Criterio de salida: NetWizard puede representar físicamente cuatro sedes conectadas por equipos L3 y redes de tránsito.

## Fase 2 — Routing estático inter-sede

Primera implementación determinista de routing corporativo.

- rutas a prefijos remotos por dispositivo;
- next-hop/interfaz/distancia;
- validación de rutas imposibles o incompletas;
- generación CLI Private Engine;
- pruebas con Cisco IOS;
- visualización del camino L3.

Criterio de salida: los prefijos de una sede pueden alcanzar explícitamente los prefijos de otra mediante rutas configuradas.

## Fase 3 — Reachability por VLAN/subnet y políticas

Añadir un análisis Derived que responda a preguntas de intención:

- VLAN/subnet origen → VLAN/subnet destino;
- camino L2/L3;
- gateways y routers atravesados;
- rutas usadas;
- política/ACL/firewall que permite o bloquea;
- motivo exacto cuando no existe conectividad.

Presentación prevista:

`CENTRAL VLAN110 → NORTE VLAN240 = REACHABLE/BLOCKED`

Criterio de salida: el usuario puede demostrar si dos segmentos de sedes distintas se comunican o no y por qué.

## Fase 4 — VPN site-to-site

Modelar overlays sobre circuitos Internet/WAN:

- peers;
- endpoints;
- redes locales/remotas;
- IKE/IPsec intent sin secretos reales;
- referencias a secretos;
- túnel principal/secundario;
- estado To-Be frente a Observed;
- generación privada por vendor soportado;
- readiness conservador.

Criterio de salida: dos sedes pueden conectarse por VPN site-to-site y NetWizard puede verificar qué prefijos pasan por el túnel.

## Fase 5 — Routing dinámico

Empezar por OSPF y ampliar solo con casos reales.

- procesos/areas;
- interfaces participantes;
- passive interfaces;
- métricas;
- resumen/anuncios;
- vecinos esperados frente a observados;
- generación y reachability derivados.

BGP, VRF y SD-WAN se incorporarán posteriormente si existe una autoridad canónica clara y suficiente demanda.

## Fase 6 — Resiliencia WAN

- doble circuito;
- primary/backup;
- tracking/IP-SLA;
- rutas flotantes;
- VPN redundante;
- failover;
- análisis de single points of failure;
- simulación de pérdida de circuito/router.

Criterio de salida: NetWizard puede explicar qué tráfico sobrevive a la pérdida de un enlace o equipo.

## Fase 7 — Flujo de instalador / as-built

Cerrar el ciclo de proyecto:

- diseño aprobado;
- plan de intervención;
- configuraciones;
- checklist pre-change;
- evidencia post-change;
- observed state;
- drift;
- as-built;
- aceptación/cierre.

## Fase 8 — BOM y presupuesto

Bloque posterior, construido sobre inventario y no como catálogo paralelo.

- precios de referencia por modelo/material;
- cantidades derivadas del inventario;
- racks, switches, routers, firewalls, ópticas, DAC, patching y cableado;
- licencias y suscripciones;
- mano de obra y desplazamientos;
- CAPEX/OPEX;
- coste interno vs precio cliente;
- margen;
- exportación de BOM y presupuesto.

La información económica deberá referenciar los objetos de inventario existentes para evitar duplicidades.

## Orden de PRs propuesto

1. VTP Production Verification.
2. Golden four-sites production example.
3. Inter-site transport + transit networks.
4. Static routing editor + Private Engine.
5. Inter-site reachability.
6. Site-to-site VPN.
7. OSPF.
8. WAN resiliency.
9. Installer/as-built workflow enhancements.
10. BOM & Budget.
