# NetWizard v3.7 · E2E smoke tests y auditoría de preparación

Esta versión añade una iteración conservadora orientada a acercar el proyecto a producción sin reescribir el núcleo.

## Cambios

### Playwright E2E smoke

Se añade:

- `playwright.config.js`
- `tests/e2e/netwizard-smoke.spec.js`
- Scripts `npm run test:e2e` y `npm run test:e2e:install`

Los smoke tests cubren:

1. Carga de `index.html` sin errores JavaScript críticos.
2. Disponibilidad de APIs globales: `NetWizardState`, `NetWizardPlanner`, `NetWizardProjectSchema`, `NetWizardBridge`.
3. Previsualización VLSM desde UI sin modificar el proyecto.
4. Aplicación VLSM mediante API, exportación versionada y reimportación.
5. Auditoría de preparación con modo producción.

Para ejecutar:

```bash
npm install
npm run test:e2e:install
npm run test:e2e
```

> Nota: los E2E requieren instalar dependencias de desarrollo. Los tests unitarios siguen ejecutándose solo con Node.js y sin navegador.

### Auditoría de preparación para producción

Se añade `NetWizardPlanner.readinessAudit(project, { productionMode })`.

Valida de forma global:

- Errores de capa 1.
- Errores de direccionamiento.
- VLANs sin subnet.
- Varias VLANs sin dispositivo capaz de routing inter-VLAN.
- Enlaces físicos con varias VLANs pero sin trunks.
- Hosts estáticos sin IP.
- Hosts DHCP sin ningún scope DHCP habilitado.

En modo producción, algunos avisos críticos se elevan a errores para evitar exportar o aplicar diseños incompletos.

### UI

Se añade una tarjeta en el dashboard:

```text
✅ Preparación para producción
```

Permite lanzar la auditoría y activar el modo producción.

## Comprobaciones realizadas

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_7_e2e_readiness.zip
```

Los E2E se han añadido y validado sintácticamente, pero no se han ejecutado en este entorno porque requieren instalar Playwright y Chromium.

## Próximos pasos recomendados

1. Ampliar E2E usando formularios reales: crear VLAN, dispositivo, puerto, host y enlace desde la UI.
2. Añadir motor de intención por VLAN.
3. Generar DHCP scopes desde intención y VLSM.
4. Añadir políticas firewall/ACL desde matriz de intención.
5. Extraer generadores por vendor para poder testearlos individualmente.
