# NetWizard v3.40 · Legacy Render Migration III

Esta versión continúa la reducción prudente de superficie XSS sin introducir funcionalidades nuevas.

## Cambios principales

- Migrado `netwizard-connectivity-checker.js` para construir la tarjeta, selectores y resultados con `createElement`, `textContent` y listeners normales.
- Migrado `netwizard-graph-viewer.js` para construir el visor, resumen y panel de detalles sin `innerHTML`.
- Migrado `netwizard-history.js` para crear la tarjeta y tabla de snapshots con DOM seguro.
- Migrado el panel de detalles de `netwizard-unified-config-map.js` para evitar interpolar datos de proyecto como HTML.

## Resultado de auditoría XSS

La auditoría estática baja de:

```text
105 HTML sinks reviewed / 67 patterns require manual review  (v3.39)
```

a:

```text
91 HTML sinks reviewed / 58 patterns require manual review  (v3.40)
```

El auditor sigue siendo conservador: los patrones restantes requieren revisión manual, pero no equivalen automáticamente a vulnerabilidades confirmadas.

## Regla de mantenimiento

Cuando se rendericen datos procedentes del proyecto, de JSON importado o de campos editables, preferir:

```js
node.textContent = value;
```

frente a:

```js
node.innerHTML = value;
```

Si una plantilla HTML es inevitable, los datos deben pasar por `NetWizardSecurityUtils`.
