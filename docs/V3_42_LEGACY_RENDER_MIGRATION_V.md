# NetWizard v3.43 · Legacy Render Migration V

Esta versión continúa la reducción progresiva de superficie XSS legacy.

## Cambios principales

- Migra el panel clásico V5 a construcción DOM segura (`createElement`, `textContent`, `addEventListener`).
- El tooltip de enlaces V5 deja de usar `innerHTML` y renderiza contenido como texto.
- Los selectores RoaS pasan a usar opciones DOM seguras.
- El panel IoT embebido migra listas, estadísticas, selectores y panel de detalle a nodos DOM/dataset.
- El panel PoE migra tablas e inputs a renderizado DOM en lugar de plantillas HTML.

## Resultado de auditoría XSS

La auditoría baja de 44 sinks / 26 patrones manuales en v3.41 a 21 sinks / 12 patrones manuales en v3.43.

Los puntos restantes son sobre todo tarjetas auxiliares con HTML estático/controlado y algunos módulos pendientes de migración fina.

## Regla de mantenimiento

Para datos de proyecto importados o editables:

- Preferir `textContent`, `createElement`, `dataset` y `addEventListener`.
- Evitar `innerHTML` salvo para HTML estático sin interpolación de datos.
- Si se usa HTML dinámico por compatibilidad, escapar con `NetWizardSecurityUtils`.
