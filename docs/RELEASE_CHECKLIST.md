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
- [ ] Revisar que el runbook respeta dependencias físicas, controlador/AP y grupos HA/MLAG.
- [ ] Confirmar ticket, ventana, aprobador, acceso OOB y backups reales antes del cambio.
- [ ] Ensayar los criterios de parada y el rollback en orden inverso.
- [ ] Si el modo es incremental, comprobar cobertura, antigüedad y fabricante de todas las capturas observadas.
- [ ] Probar en la UI guardar/recargar una captura por dispositivo y descargar candidato/rollback solo cuando el preflight indique `candidate-ready`.
- [ ] Revisar los diffs observado → deseado y confirmar que nadie los tratará como comandos directos.
- [ ] Capturar fingerprints y evidencias posteriores al cambio.
- [ ] Confirmar que cada fichero `incremental/commands/` procede de un adaptador `candidate-ready`.
- [ ] Para Junos, revisar `show | compare`, ejecutar `commit check` y usar la política aprobada de `commit confirmed`.
- [ ] Para Cisco IOS, confirmar que el candidato solo toca VLAN/interfaces/rutas/DHCP permitidos, no contiene guardado automático y preserva comandos observados ajenos a NetWizard.
- [ ] Para FortiOS, confirmar VDOM, interfaces, IDs/orden de políticas, backup real y que el candidato solo toca secciones administradas.
- [ ] Para RouterOS v7, partir de `/export terse`, validar cada selector `find`, ejecutar primero `import ... verbose=yes dry-run=yes` y custodiar export y backup binario.
- [ ] No convertir estados `manual-review` en comandos mediante copia directa del diff.
- [ ] Exportar inventario CSV.
- [ ] Exportar documentación Markdown.
- [ ] Crear y restaurar snapshot.
- [ ] Resetear e importar el proyecto exportado.

## Criterio RC

La versión puede marcarse como candidata si no hay errores bloqueantes conocidos y los E2E pasan en navegador real.
