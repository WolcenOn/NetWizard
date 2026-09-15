# Checklist de release

## Antes de empaquetar

- [ ] Actualizar `package.json`.
- [ ] Actualizar `SCHEMA_VERSION` en `netwizard-project-schema.js`.
- [ ] Actualizar `schemas/netwizard-project.schema.json`.
- [ ] Añadir documento `docs/Vx_y_*.md`.
- [ ] Actualizar README.
- [ ] Añadir/actualizar tests.

## Validación local

```bash
npm test
npm run check:syntax
npm run test:e2e
```

## Validación funcional manual

- [ ] Importar samples.
- [ ] Validar `samples/production-scenarios.json` sin avisos inesperados.
- [ ] Generar las configuraciones declaradas por cada escenario de referencia.
- [ ] Crear VLAN, dispositivo, puerto, enlace y host desde UI.
- [ ] Ejecutar Plan común de cambios.
- [ ] Ejecutar Puerta de Producción.
- [ ] Exportar configuraciones.
- [ ] Exportar el paquete de despliegue ZIP y revisar su manifiesto, configuraciones e informes.
- [ ] Confirmar que un proyecto con errores bloqueantes no puede descargar el paquete de despliegue.
- [ ] Exportar inventario CSV.
- [ ] Exportar documentación Markdown.
- [ ] Crear y restaurar snapshot.
- [ ] Resetear e importar el proyecto exportado.

## Criterio RC

La versión puede marcarse como candidata si no hay errores bloqueantes conocidos y los E2E pasan en navegador real.
