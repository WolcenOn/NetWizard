# NetWizard v3.32 · Release Candidate local/controlada

Esta versión no añade un bloque funcional grande. Su objetivo es cerrar la revisión final antes de considerar NetWizard una candidata de producción para uso local/controlado.

## Cambios principales

- Versión del paquete actualizada a `3.32.0`.
- Schema interno actualizado a `3.32.0`.
- Schema externo actualizado para aceptar exportaciones `3.32.0`.
- README reescrito como guía de Release Candidate.
- Añadidas guías finales:
  - `docs/PRODUCTION_READINESS.md`
  - `docs/MAINTENANCE_GUIDE.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/LIMITATIONS_KNOWN.md`
- Comentarios de mantenimiento añadidos en módulos críticos:
  - `netwizard-project-schema.js`
  - `netwizard-production-gate.js`
  - `netwizard-change-plan.js`
  - `netwizard-change-preview.js`
  - `netwizard-vlsm-physical-planner.js`
  - `netwizard-dhcp-utils.js`
  - `netwizard-policy-utils.js`
  - `netwizard-l2-utils.js`
  - `netwizard-cabling-utils.js`
  - `netwizard-poe-utils.js`
  - `netwizard-broadcast-utils.js`
  - `netwizard-vendor-hardening.js`

## Estado

Queda como candidata de producción local/controlada cuando pasan:

```bash
npm test
npm run check:syntax
npm run test:e2e
```

Y cuando el proyecto real pasa la Puerta de Producción sin errores bloqueantes.
