# NetWizard v3.34 · RC Hardening Fixes

Esta versión no añade automatismos grandes. Corrige puntos detectados en la revisión de la v3.32 para hacer la RC más reproducible, segura y distribuible en modo local/controlado.

## Cambios principales

1. **E2E reproducibles**
   - `@playwright/test` queda fijado en `package-lock.json`.
   - Los scripts usan `npx playwright` para priorizar dependencias locales.
   - Se corrige el test E2E que todavía esperaba `3.29.0`.

2. **Mitigación XSS en auditoría unificada V5**
   - `renderUnifiedDetails` ya no interpola valores del proyecto sin escapar.
   - Se añade prueba de regresión que inspecciona la función y exige `escHtml`.

3. **Distribución más clara**
   - Nuevo `LICENSE` de evaluación/control privado.
   - Nuevo `CHANGELOG.md`.
   - Nuevo script `npm run build:zip`.
   - Versión visible en la cabecera de la aplicación.

## Comandos recomendados

```bash
npm install
npm test
npm run check:syntax
npm run test:e2e:install
npm run test:e2e
npm run build:zip
```

## Estado

Si los E2E pasan en un navegador real y el proyecto objetivo pasa la Puerta de Producción, esta versión puede tratarse como RC local/controlada validada.
