# Change set y evidencia observada 3.50

NetWizard puede comparar la configuración objetivo generada con una captura real previa. El resultado se incorpora al paquete de despliegue como evidencia revisable y como apoyo al rollback.

## Modos

- `full`: permite generar el paquete sin capturas reales. Cada equipo queda marcado como `baseline-required` y se usa su configuración objetivo completa.
- `incremental`: exige una captura válida, reciente y del mismo fabricante para todos los dispositivos. Si falta o no es fiable, el ZIP queda bloqueado.

## Contrato del proyecto

```json
{
  "deployment": {
    "changeMode": "incremental",
    "maxObservedAgeHours": 24
  },
  "observedState": {
    "observedAt": "2026-09-16T10:00:00Z",
    "source": "captura manual aprobada",
    "deviceConfigs": {
      "sw-core-01": {
        "vendor": "cisco_ios",
        "capturedAt": "2026-09-16T10:00:00Z",
        "source": "show running-config",
        "content": "hostname SW-CORE-01\n..."
      }
    }
  }
}
```

El schema conserva hasta 256 KiB por configuración observada y 4 MiB en total. Una captura truncada se etiqueta y bloquea el modo incremental.

Las colecciones estructurales (`devices`, `ports`, `vlans`, etc.) son opcionales en un snapshot. La auditoría de drift solo compara aquellas que estén presentes, por lo que una captura exclusivamente de configuraciones no inventa recursos ausentes.

## Artefactos

- `changes/change-set.json`: estado, cobertura, fingerprints y estadísticas por dispositivo.
- `changes/summary.md`: lectura humana del cambio.
- `changes/patches/*.diff`: comparación observado → deseado.
- `changes/rollback/*.diff`: comparación inversa deseado → observado.
- `evidence/pre-change.json`: metadatos y fingerprints de la evidencia previa.
- `evidence/post-change-checklist.md`: comprobaciones y nueva captura posterior.

## Límite de seguridad

Los `.diff` no son comandos para pegar en los equipos. Son evidencia exacta de texto para revisión. La aplicación debe seguir realizándose con el mecanismo transaccional o de sustitución soportado por cada fabricante y con un backup real previamente verificado.

El fingerprint `fnv1a32` sirve para detectar cambios accidentales dentro del paquete; no es una firma criptográfica ni acredita la procedencia de una captura.
