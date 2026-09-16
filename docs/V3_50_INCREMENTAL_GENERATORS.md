# Generadores incrementales seguros 3.50

NetWizard dispone de un registro separado para transformar un change set revisado en candidatos cargables por fabricante. El registro usa denegación por defecto: si un formato no puede interpretarse sin ambigüedad, conserva el diff y la configuración objetivo, pero no genera CLI.

## Estado de soporte

| Fabricante | Adaptador | Resultado |
|---|---|---|
| Juniper Junos | `junos.set-delta` | Candidato `set/delete` y candidato inverso |
| Cisco IOS | `cisco-ios.managed-delta` | Candidato jerárquico para VLAN, interfaces, rutas estáticas y DHCP |
| Cisco ASA | — | Revisión manual |
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

## Cisco IOS

La captura recomendada es `show running-config`, sin prompts ni paginación. El parser conserva la jerarquía de bloques y solo administra una allowlist explícita:

- VLAN y nombre;
- interfaces: descripción, modo/access/trunk, VLANs, direccionamiento IPv4, estado administrativo, RoaS/NAT y controles L2 emitidos por NetWizard;
- rutas estáticas IPv4 simples con siguiente salto;
- exclusiones y pools DHCP básicos.

El objetivo de NetWizard se interpreta como configuración administrada, no como sustitución completa del running-config. Los comandos adicionales observados se preservan. Un comando desconocido presente en el objetivo debe existir de forma idéntica en la captura; si cambia, el equipo pasa a `manual-review`.

El adaptador no elimina bloques completos simplemente porque no aparezcan en el objetivo. Sí puede crear VLAN/pool, actualizar propiedades explícitas y sustituir de forma exacta una ruta para un prefijo sin ECMP. Rutas con interfaz de salida, VRF, tracking, nombres, ECMP u otras variantes quedan en revisión manual.

Los candidatos `.cfg` incluyen `configure terminal` y `end`, pero nunca guardan la configuración. `write memory`/`copy running-config startup-config` quedan fuera del fichero y requieren aprobación explícita después de los postchecks. El rollback inverso es auxiliar: la captura real previa continúa siendo la fuente autoritativa.

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
- `incremental/commands/*.cfg`: candidato Cisco IOS administrado.
- `incremental/rollback/*`: candidato inverso según fabricante.

El backup real capturado antes del cambio sigue siendo la fuente autoritativa para una reversión. El candidato inverso no lo sustituye.
