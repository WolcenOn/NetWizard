# NetWizard v3.34 · XSS hardening ampliado

Esta versión reduce superficie XSS sin introducir cambios funcionales grandes.

## Cambios

- Nuevo `js/netwizard-security-utils.js` con helpers `escapeHtml`, `escapeAttr`, `html`, `rawHtml` y `setSafeText`.
- Carga explícita del módulo de seguridad después de `netwizard-core-utils.js`.
- Los módulos visuales principales reutilizan el helper centralizado cuando está disponible.
- Endurecimiento de atributos `data-*` en paneles IoT.
- Corrección del escape local en V5 IoT para incluir comillas dobles.
- Tests de regresión con payloads HTML maliciosos y revisión estática de puntos sensibles.

## Regla de mantenimiento

Todo dato procedente del proyecto importado debe renderizarse con `textContent` o escapar con `NetWizardSecurityUtils.escapeHtml()` antes de entrar en `innerHTML`.

`rawHtml()` solo debe usarse para HTML estático o fragmentos generados por código interno ya escapado.
