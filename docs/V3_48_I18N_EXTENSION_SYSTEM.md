# NetWizard v3.48 · Sistema i18n ampliable

Esta versión convierte la traducción en un sistema mantenible y ampliable, no solo en una colección de textos ES/EN.

## Objetivo

Facilitar que NetWizard pueda traducirse de forma progresiva a nuevos idiomas sin tocar el modelo interno del proyecto ni el schema JSON.

El principio clave se mantiene:

- Las claves internas siguen en inglés: `devices`, `ports`, `vlans`, `links`, `dhcp`, etc.
- Solo se traducen textos visibles de UI, informes, checklists y mensajes.
- Las traducciones se renderizan como texto plano para no reabrir riesgos XSS.

## Nuevos archivos

```text
i18n/locales.json
scripts/i18n-check.js
scripts/i18n-sync.js
scripts/i18n-new-locale.js
scripts/i18n-audit-hardcoded.js
docs/I18N_MAINTENANCE.md
docs/I18N_HARDCODED_AUDIT.txt
```

## Nuevos comandos

```bash
npm run i18n:check
npm run i18n:sync
npm run i18n:new -- pt-BR "Português (Brasil)" en
npm run i18n:audit
```

## Flujo para añadir un idioma

1. Crear el idioma desde una base existente:

```bash
npm run i18n:new -- pt-BR "Português (Brasil)" en
```

2. Traducir `i18n/pt-BR.json`.
3. Validar claves, placeholders y seguridad:

```bash
npm run i18n:check
```

4. Sincronizar el módulo embebido usado por la app:

```bash
npm run i18n:sync
```

5. Ejecutar pruebas:

```bash
npm test
npm run check:syntax
npm run audit:xss
```

## Qué valida `i18n:check`

- Todos los idiomas tienen las mismas claves que el idioma base.
- No hay claves extra o ausentes.
- Los placeholders `{project}`, `{date}`, `{count}`, etc. coinciden.
- Las traducciones no contienen HTML/JS peligroso.
- Los valores son strings.

## Qué hace `i18n:sync`

Genera `js/netwizard-i18n.js` desde:

```text
i18n/*.json
i18n/locales.json
```

Por eso, para mantener el sistema limpio, no se debe editar manualmente el objeto `dictionaries` dentro de `netwizard-i18n.js`.

## Auditoría de textos hardcoded

`npm run i18n:audit` genera:

```text
docs/I18N_HARDCODED_AUDIT.txt
```

Ese informe lista candidatos a texto visible que todavía podrían convertirse a claves i18n. No todos son errores; algunos son términos técnicos, comandos, documentación o cadenas internas.

## Estado

v3.48 deja la base preparada para traducir de forma completa pantalla por pantalla y para añadir idiomas como portugués o francés con bajo riesgo.
