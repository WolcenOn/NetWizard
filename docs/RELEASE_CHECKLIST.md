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
- [ ] Crear VLAN, dispositivo, puerto, enlace y host desde UI.
- [ ] Ejecutar Plan común de cambios.
- [ ] Ejecutar Puerta de Producción.
- [ ] Exportar configuraciones.
- [ ] Exportar inventario CSV.
- [ ] Exportar documentación Markdown.
- [ ] Crear y restaurar snapshot.
- [ ] Resetear e importar el proyecto exportado.

## Criterio RC

La versión puede marcarse como candidata si no hay errores bloqueantes conocidos y los E2E pasan en navegador real.
