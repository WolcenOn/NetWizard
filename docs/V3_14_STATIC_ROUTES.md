# NetWizard v3.14 · Rutas estáticas básicas desde enlaces de tránsito L3

La v3.14 añade una primera inferencia prudente de rutas estáticas basada en las redes de tránsito L3 ya introducidas en v3.11-v3.13.

## Objetivo

Cerrar el siguiente tramo del flujo:

1. Definir enlace físico L3 entre dispositivos.
2. Asociar VLAN/red de tránsito.
3. Asignar IPs a las interfaces routed.
4. Exportar interfaces L3.
5. Inferir rutas estáticas básicas hacia redes locales del vecino.

## Nuevo módulo

Se añade:

```text
js/netwizard-routing-utils.js
```

Funciones principales:

```js
NetWizardRoutingUtils.collectLocalNetworks(project, deviceId)
NetWizardRoutingUtils.inferStaticRoutes(project, deviceId)
NetWizardRoutingUtils.summarizeRoutes(routes)
```

## Criterio conservador

Por prudencia, la inferencia solo propone rutas cuando hay datos suficientes:

- Interfaz L3 local con IP y CIDR.
- Interfaz L3 vecina con IP.
- Enlace físico entre ambas.
- El vecino posee redes locales claramente atribuibles.

Se consideran redes locales atribuibles cuando el dispositivo es:

- Gateway RoaS configurado en `roas.gwId`.
- Firewall / FortiGate / pfSense / Cisco ASA.
- Dispositivo marcado explícitamente como `vlanGateway: "yes"`.

No se inventan rutas por defecto ni rutas dinámicas.

## Exportación vendor

La v3.14 añade rutas inferidas a:

- Cisco IOS router / switch L3: `ip route ...`
- Cisco ASA: `route <interface> ...`
- Juniper Junos: `set routing-options static route ...`
- FortiGate: `config router static`
- pfSense: comentarios guía para GUI

## Limitaciones conocidas

- No hay OSPF/EIGRP/BGP todavía.
- No hay coste/métrica avanzada salvo valor básico.
- No hay detección completa de SVIs por dispositivo L3 switch.
- No se generan rutas por defecto automáticamente.
- En topologías con más de un salto, solo se infieren rutas vecinas directas.

## Validación

Se amplían los tests unitarios para comprobar que un router vecino aprende una ruta hacia la red local anunciada por el gateway conectado por tránsito L3.
