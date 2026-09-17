# Generadores incrementales seguros 3.50

NetWizard dispone de un registro separado para transformar un change set revisado en candidatos cargables por fabricante. El registro usa denegación por defecto: si un formato no puede interpretarse sin ambigüedad, conserva el diff y la configuración objetivo, pero no genera CLI.

## Estado de soporte

| Fabricante | Adaptador | Resultado |
|---|---|---|
| Juniper Junos | `junos.set-delta` | Candidato `set/delete` y candidato inverso |
| Cisco IOS | `cisco-ios.managed-delta` | Candidato jerárquico para VLAN, interfaces, rutas estáticas y DHCP |
| Cisco ASA | — | Revisión manual |
| Fortinet FortiOS | `fortios.managed-delta` | Candidato jerárquico para interfaces, objetos, zonas, rutas, políticas, DHCP y gestión básica |
| MikroTik RouterOS v7 | `routeros-v7.managed-delta` | Candidato `.rsc` para bridge/VLAN, routing, DHCP, VRRP y gestión básica |
| Huawei, Aruba | — | Revisión manual |
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

## Fortinet FortiOS

La captura recomendada es `show full-configuration`, obtenida en el VDOM correcto y sin prompts ni paginación. `fortios.managed-delta` interpreta la jerarquía `config/edit/set/next/end`, fusiona secciones repetidas compatibles y solo administra:

- hostname y parámetros básicos DNS/NTP/syslog;
- interfaces físicas/VLAN y relay DHCP;
- objetos de dirección y zonas;
- rutas estáticas simples;
- políticas firewall básicas, NAT y logging;
- servidores DHCP e `ip-range`;
- referencias RADIUS/SNMP ya existentes, bloqueando cualquier cambio de secreto.

Las secciones no administradas —por ejemplo OSPF avanzado, SD-WAN, VPN, UTM, certificados o HA/FGCP— deben coincidir exactamente si aparecen en el objetivo; cualquier modificación pasa a `manual-review`. Los objetos nuevos se revierten con `delete`, mientras que los campos modificados restauran su `set` observado o usan `unset` cuando antes no existían.

Los candidatos `.conf` no ejecutan backups, reinicios ni acciones de despliegue remoto. Antes de aplicar se deben confirmar VDOM, nombres de interfaz, IDs y orden de políticas, además de conservar un backup real de FortiGate.

## MikroTik RouterOS v7

La captura recomendada es un export `terse` completo, porque presenta cada comando con su ruta de menú en una sola línea y oculta los valores sensibles por defecto:

```text
/export terse
```

`routeros-v7.managed-delta` normaliza tanto `/ip route add` como `/ip/route/add`. Empareja las filas únicamente mediante identidades estables y explícitas —por ejemplo `name`, `bridge+interface`, `bridge+vlan-ids`, `dst-address+distance` o `area+networks`— y administra una allowlist limitada:

- bridge, puertos bridge, VLANs, bonding y VRRP;
- direcciones, pools, DHCP server/client/relay y NAT de salida generado por NetWizard;
- rutas estáticas y OSPF v7 básico;
- identidad, DNS, NTP, servicios IP, syslog y activación básica de SNMP.

Una fila existente se cambia mediante `set [find where …]`; el rollback restaura sus valores observados o usa `unset` cuando la propiedad no existía. Una fila nueva solo se admite si la captura conserva una cabecera que la identifica como export completo de RouterOS v7; se aplica mediante su `add` objetivo y el rollback solo puede eliminar esa misma alta por su identidad estable. Las filas observadas ausentes del objetivo se conservan: el adaptador no interpreta la configuración generada como un reemplazo completo del router. Cualquier `#error exporting` invalida la captura.

Scripts, acciones `remove`/`unset` en el objetivo, selectores dinámicos ya escritos con `[find …]`, identidades duplicadas, campos fuera de allowlist, secretos y placeholders pasan a `manual-review`. Antes de importar hay que confirmar que cada selector devuelve exactamente una fila.

Los candidatos usan extensión `.rsc`. Se recomienda comprobar primero la sintaxis con `import file-name=<candidato>.rsc verbose=yes dry-run=yes` en una versión RouterOS compatible, mantener acceso MAC/serial/OOB y conservar tanto el export como un backup binario real. El candidato no activa Safe Mode, no reinicia y no crea backups automáticamente.

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
- `incremental/commands/*.conf`: candidato FortiOS administrado.
- `incremental/commands/*.rsc`: candidato RouterOS v7 administrado.
- `incremental/rollback/*`: candidato inverso según fabricante.

El backup real capturado antes del cambio sigue siendo la fuente autoritativa para una reversión. El candidato inverso no lo sustituye.
