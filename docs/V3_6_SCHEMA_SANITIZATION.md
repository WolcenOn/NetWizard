# NetWizard v3.6 · Schema, migraciones y sanitización

Esta versión añade una capa conservadora de robustez para acercar el proyecto a uso real sin reescritura completa.

## Cambios

- Nuevo módulo `js/netwizard-project-schema.js`.
- Se añade `_schemaVersion: "3.6.0"` al proyecto.
- Exportación JSON envuelta en un payload versionado:
  - `format: "netwizard-project"`
  - `schemaVersion`
  - `exportedAt`
  - `project`
- Importación compatible con:
  - JSON legacy plano.
  - JSON nuevo con `{ project: ... }`.
  - Payloads con IoT externo que se migran a `project.iot`.
- Sanitización centralizada para cadenas e identificadores.
- Validación básica de integridad antes de importar:
  - IDs duplicados.
  - Referencias críticas inexistentes.
  - VLAN IDs fuera de rango.
  - CIDR inválido.
  - Enlaces con puertos inexistentes.
- Nuevos helpers CLI en `netwizard-core-utils.js`:
  - `safeCliText`
  - `safeCliToken`
  - `safeQuotedCli`
- Generadores de configuración actualizados parcialmente para evitar saltos de línea o caracteres peligrosos en nombres/descripciones.

## Objetivo

Reducir riesgo de:

- Proyectos corruptos importados.
- Datos legacy sin migrar.
- Inyección accidental en configuraciones generadas.
- Referencias rotas que rompan vistas o cálculos posteriores.

## Limitaciones conocidas

- No es todavía un JSON Schema formal externo `.schema.json`.
- No hay Playwright/E2E todavía.
- La sanitización de configs no cubre al 100% todos los vendors/campos posibles.
- Todavía no hay historial completo de migraciones por archivo independiente.

## Checks ejecutados

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_6_schema_sanitization.zip
```
