# Guía de mantenimiento i18n

## Reglas principales

1. No traduzcas claves internas del proyecto ni del schema.
2. Usa `t('clave')` para texto visible.
3. Usa `textContent`, `placeholder` o atributos seguros; no uses `innerHTML` con traducciones.
4. Mantén los placeholders iguales en todos los idiomas.
5. Ejecuta `npm run i18n:check` antes de hacer release.

## Estructura

```text
i18n/
  locales.json
  es.json
  en.json
```

`locales.json` define qué idiomas aparecen en los selectores.

Cada `*.json` contiene las mismas claves.

## Añadir idioma

```bash
npm run i18n:new -- pt-BR "Português (Brasil)" en
```

Después traduce `i18n/pt-BR.json` y ejecuta:

```bash
npm run i18n:check
npm run i18n:sync
npm test
```

## Placeholders

Correcto:

```json
{
  "doc.title": "Documentación NetWizard — {project}"
}
```

La traducción debe conservar `{project}`.

Incorrecto:

```json
{
  "doc.title": "Documentación NetWizard"
}
```

## Seguridad

No introduzcas HTML en traducciones:

```json
{
  "actions.save": "<b>Guardar</b>"
}
```

El check fallará porque las traducciones deben ser texto plano.

## Auditoría de cobertura

```bash
npm run i18n:audit
```

Genera un informe de candidatos hardcoded. Úsalo como lista de trabajo para ir convirtiendo textos a claves.
