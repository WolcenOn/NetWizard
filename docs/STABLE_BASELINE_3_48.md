# NetWizard 3.48.0 · Línea base estable

## Estado

NetWizard `3.48.0` queda definido como la línea base canónica para estabilización, pruebas y futuras migraciones.

Esta línea base es una **Release Candidate para uso local/controlado**. No debe presentarse todavía como SaaS multiusuario ni como herramienta de aplicación automática de configuraciones en producción.

## Fuentes de versión

La versión canónica debe mantenerse sincronizada en:

- `VERSION`
- `package.json`
- `_schemaVersion` del proyecto
- textos de interfaz e i18n
- `README.md`
- `CHANGELOG.md`
- etiquetas y releases de GitHub

## Criterios para promoverla a estable

Antes de publicar una etiqueta estable deben pasar:

1. `npm run release:check`
2. `npm run test:e2e`
3. Importación y exportación de los samples oficiales
4. Puerta de producción sin errores bloqueantes en los proyectos de referencia
5. Revisión manual de las exportaciones vendor soportadas
6. Verificación de recuperación mediante export JSON/snapshot

## Política de ramas

- `main`: versión publicable y protegida
- `develop`: integración de cambios validados
- `feature/*`: nuevas funcionalidades
- `fix/*`: correcciones
- `chore/*`: mantenimiento y documentación

Los cambios deben llegar a `main` mediante pull request y con las comprobaciones automáticas superadas.

## Próximo incremento

Las correcciones compatibles con esta línea base usarán `3.48.x`. Las nuevas capacidades que cambien comportamiento visible o contrato de datos deberán preparar la siguiente versión menor.
