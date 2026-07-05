# NetWizard v3.48 · i18n reports & audit messages

Esta versión amplía la infraestructura bilingüe ES/EN de v3.44.

## Cambios principales

- Traducción inicial de la tarjeta Puerta de producción.
- Checklist Markdown de producción localizado según el idioma de informes.
- Guía de corrección con cabeceras/severidades localizadas.
- Matriz de conectividad con motivos básicos traducibles.
- Nuevas claves i18n para producción, checklist, matriz y documentación.
- Tests para checklist EN y matriz localizada.

## Regla de mantenimiento

Las traducciones deben seguir siendo texto plano. No introducir HTML en los diccionarios i18n.
Si se necesitan fragmentos enriquecidos, construir nodos DOM con `createElement` y `textContent`.
