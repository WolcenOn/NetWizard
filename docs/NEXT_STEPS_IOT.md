# Preparación IoTWizard

La v1.1 no integra IoTWizard todavía. Deja el código ordenado para hacerlo de forma segura.

## Próxima integración recomendada

Crear adaptador en solo lectura:

```js
function getNetWizardProjectSnapshot() {
  return structuredClone(S);
}

function netWizardToUnifiedGraph(project) {
  return {
    nodes: [],
    links: [],
    segments: []
  };
}
```

## Regla de seguridad

El adaptador de IoT debe leer datos de NetWizard, pero no modificar `S` hasta que haya una acción explícita del usuario.

## Objetivo final

- NetWizard aporta infraestructura: routers, switches, firewalls, APs, VLANs, subnets y enlaces.
- IoTWizard aporta sensores, cámaras, hubs, gateways, credenciales y conexiones lógicas.
- Ambos generan un grafo común y un informe común.
