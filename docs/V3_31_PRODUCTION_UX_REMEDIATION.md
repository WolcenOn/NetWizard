# NetWizard v3.31 · Production UX & Remediation Guide

Esta versión mejora la Puerta de producción para que no solo bloquee o avise, sino que explique cómo corregir cada incidencia.

## Cambios principales

- Guía de corrección priorizada por incidencia.
- Explicación de impacto: por qué importa cada fallo.
- Sección recomendada donde corregirlo.
- Pasos concretos de remediación.
- Checklist Markdown exportable para revisiones previas a despliegue.
- API testeable para generar guías y checklist desde `NetWizardProductionGate`.

## API añadida

```js
NetWizardProductionGate.remediationForIssue(issue)
NetWizardProductionGate.buildRemediationGuide(report, options)
NetWizardProductionGate.summarizeRemediationGuide(report, options)
NetWizardProductionGate.exportChecklistMarkdown(report, options)
```

## Uso recomendado

1. Activa modo producción.
2. Ejecuta la Puerta de producción.
3. Revisa la guía de corrección.
4. Corrige primero errores bloqueantes.
5. Descarga checklist y úsalo como evidencia de revisión.
6. Repite hasta que no haya bloqueos.

## Limitación

La guía automatiza recomendaciones, pero no reemplaza una revisión técnica de laboratorio antes de aplicar configuración real.
