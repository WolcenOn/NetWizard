# NetWizard v3.29 · E2E completos de producción

Esta versión amplía la base de Playwright para cubrir flujos de navegador más cercanos al uso real antes de declarar una versión candidata de producción.

## Cambios principales

- Nuevo archivo `tests/e2e/netwizard-production-flow.spec.js`.
- Importación de los samples oficiales desde el navegador.
- Validación de schema/exportación tras importar samples.
- Ejecución de la puerta de producción desde UI y API.
- Validación de inventario, documentación Markdown y matriz de conectividad.
- Aplicación del Plan común de cambios desde UI con VLSM + DHCP, confirmación y snapshot previo.
- Verificación de descargas Markdown/CSV mediante eventos de Playwright.
- Prueba de bloqueo de la puerta de producción ante un diseño incompleto.

## Ejecutar

```bash
npm run test:e2e:install
npm run test:e2e
```

Para inspección visual:

```bash
npm run test:e2e:headed
```

Para abrir el reporte tras una ejecución:

```bash
npm run test:e2e:report
```

## Alcance

La v3.29 no cambia el modelo funcional de red. Su objetivo es aumentar la confianza en importación, plan común, documentación, descargas y puerta de producción mediante pruebas E2E.

## Pendiente

- Ejecutar Playwright completo en un entorno con Chromium instalado.
- Añadir E2E específicos por vendor export.
- Añadir E2E de corrección asistida de incidencias.
- Añadir E2E de visualización gráfica/V5 cuando haya fixtures estables.
