# NetWizard v3.48 · i18n full UI pass

Esta versión amplía la internacionalización ES/EN más allá de informes y auditorías.

## Cambios

- Diccionarios ES/EN ampliados con acciones, formularios, secciones, mensajes comunes y textos de producción.
- Traducción exacta progresiva de textos visibles generados por renders legacy mediante `NetWizardI18n.applyI18n`.
- `refresh()` aplica i18n al final de cada render principal para que los textos dinámicos también se localicen.
- Se mantiene el modelo interno, schema y JSON en inglés para no romper compatibilidad.
- Las traducciones siguen tratándose como texto plano para mantener el hardening XSS.

## Alcance

No todo el código está sustituido por claves i18n explícitas todavía. Esta fase cubre gran parte de la UI mediante claves y traducción exacta segura. Las siguientes versiones pueden ir sustituyendo textos hardcoded por `t(key)` módulo a módulo.
