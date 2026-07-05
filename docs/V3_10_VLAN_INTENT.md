# NetWizard v3.10 · Intención por VLAN

Esta versión introduce una primera capa de intención por VLAN para avanzar hacia un planificador de red orientado a objetivos sin romper proyectos existentes.

## Añadido

- Nuevo módulo `js/netwizard-vlan-intent.js`.
- Nueva tarjeta “🎯 Intención por VLAN” en la sección VLANs & Subnets.
- Tipos predefinidos:
  - Usuarios
  - Servidores
  - IoT
  - Invitados
  - Gestión
  - Voz
  - Cámaras
  - DMZ
  - Tránsito L3
  - Personalizada
- Campos por VLAN:
  - Hosts previstos
  - Crecimiento
  - DHCP sí/no
  - Internet sí/no
  - Aislamiento: estándar, restringido, aislado
  - Criticidad
  - Notas

## Integración con VLSM

`NetWizardPlanner.inferVlanNeeds()` ahora considera la intención:

- hosts reales observados,
- puertos access,
- dispositivos IoT,
- hosts previstos,
- crecimiento esperado.

El resultado es que el plan VLSM reserva capacidad más realista aunque aún no existan todos los hosts dibujados.

## Recomendaciones

El nuevo módulo genera recomendaciones no destructivas para:

- DHCP,
- aislamiento inter-VLAN,
- acceso a Internet,
- IoT,
- invitados,
- gestión,
- servidores,
- cámaras,
- voz,
- DMZ,
- tránsito L3.

## Propuesta DHCP

La acción “Proponer DHCP” puede activar o desactivar scopes básicos según la intención. No genera todavía pools detallados ni exclusiones avanzadas.

## Pendiente

- DHCP scopes completos con rangos, exclusiones y reservas.
- Políticas firewall/ACL generadas desde intención.
- Vista previa diff antes de aplicar cambios de intención.
- Validación de intención en modo producción.
- E2E específico de intención por VLAN.
