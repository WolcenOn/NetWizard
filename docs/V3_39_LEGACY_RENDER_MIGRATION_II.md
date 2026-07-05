# NetWizard v3.39 · Legacy Render Migration II

Esta versión continúa el hardening XSS sin añadir funcionalidades grandes.

## Zonas migradas a DOM seguro

- `renderVlans()`
- `renderSubnets()`
- `renderVlanMatrix()`
- `renderFwTplModal()`
- `renderDevPickCfg()`
- `renderVtp()`
- Pills de vendor en configuración y modal de configuración
- Metadatos del modal de configuración de dispositivo

## Criterio de seguridad

Los datos importables del proyecto no deben interpolarse directamente con `innerHTML`.
Cuando sea posible se debe usar:

```js
const node = document.createElement('div');
node.textContent = userValue;
```

Cuando se necesita HTML estático, solo se acepta si no contiene datos del proyecto o si pasa por helpers de escape centralizados.

## Resultado del auditor

El informe actualizado está en:

```text
docs/XSS_AUDIT_REPORT_V3_39.txt
```

El auditor sigue siendo conservador: los puntos marcados son revisión manual pendiente, no vulnerabilidades confirmadas.
