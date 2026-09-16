# Generadores incrementales seguros 3.50

NetWizard dispone de un registro separado para transformar un change set revisado en candidatos cargables por fabricante. El registro usa denegación por defecto: si un formato no puede interpretarse sin ambigüedad, conserva el diff y la configuración objetivo, pero no genera CLI.

## Estado de soporte

| Fabricante | Adaptador | Resultado |
|---|---|---|
| Juniper Junos | `junos.set-delta` | Candidato `set/delete` y candidato inverso |
| Cisco IOS/ASA | — | Revisión manual; la jerarquía CLI requiere un parser específico |
| Fortinet, Huawei, MikroTik, Aruba | — | Revisión manual |
| pfSense, UniFi, Omada, Galgus | — | Revisión manual/controlador |
| Windows, Linux | — | Revisión manual |

## Junos

La captura observada debe proceder de un formato `display set`, por ejemplo:

```text
show configuration | display set | no-more
```

El adaptador solo admite líneas vacías, comentarios `#` y comandos `set`. Calcula:

- altas: comandos `set` presentes en el objetivo y ausentes en la captura;
- bajas: comandos observados ausentes en el objetivo, convertidos exactamente a `delete`;
- rollback candidato: operación inversa del delta.

Si aparece una línea de otro formato, un placeholder o una operación que toca secretos/credenciales, el equipo pasa a `manual-review`.

Los ficheros `.set` no incluyen `commit`: deben cargarse en candidate configuration, revisarse mediante `show | compare` y superar `commit check`. Se recomienda `commit confirmed` conforme a la política operativa.

## Política estricta

```json
{
  "deployment": {
    "changeMode": "incremental",
    "maxObservedAgeHours": 24,
    "requireExecutableIncremental": true
  }
}
```

Con `requireExecutableIncremental: true`, cualquier dispositivo que necesite cambios y no tenga adaptador seguro bloquea el paquete. Los dispositivos cuyo fingerprint no cambia quedan como `no-change` y no necesitan adaptador.

## Artefactos

- `incremental/plan.json`: decisión, adaptador y estado por dispositivo.
- `incremental/summary.md`: resumen revisable.
- `incremental/commands/*.set`: candidato Junos observado → deseado.
- `incremental/rollback/*.set`: candidato inverso.

El backup real capturado antes del cambio sigue siendo la fuente autoritativa para una reversión. El candidato inverso no lo sustituye.
