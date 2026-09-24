# Operación SaaS: PostgreSQL, migraciones y recuperación

## Objetivo

Esta guía fija el mínimo operativo antes de activar escritura remota de proyectos.

## Arranque y migraciones

Cuando `DATABASE_URL` está configurada, el backend debe fallar el arranque si:

- PostgreSQL no responde;
- una migración no puede aplicarse;
- el esquema queda en un estado desconocido.

Las migraciones son forward-only y se registran en `schema_migrations`. El runner usa un advisory lock para impedir que dos instancias apliquen la misma migración simultáneamente.

No se debe editar una migración ya aplicada en producción. Los cambios posteriores se introducen con una nueva migración numerada.

## Backup mínimo antes de E4

Antes de habilitar CRUD remoto para usuarios reales debe existir:

- backup administrado del proveedor de PostgreSQL;
- retención suficiente para recuperar borrados o corrupción no detectada inmediatamente;
- al menos un backup lógico periódico mediante `pg_dump`;
- cifrado en tránsito y en reposo para los backups;
- almacenamiento de backups fuera de la misma instancia de base de datos;
- un restore probado y documentado.

Ejemplo de backup lógico:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > netwizard-$(date +%Y%m%d-%H%M).dump
```

Las credenciales no deben escribirse en scripts ni commits; se suministran mediante variables o secretos del entorno.

## Restauración

Una restauración debe probarse primero sobre una base vacía o de staging.

Ejemplo:

```bash
pg_restore --clean --if-exists --no-owner --no-acl   --dbname "$RESTORE_DATABASE_URL" netwizard-YYYYMMDD-HHMM.dump
```

Después del restore se debe verificar:

1. que el backend arranca y no tiene migraciones fallidas;
2. que `schema_migrations` contiene la secuencia esperada;
3. que proyectos y revisiones son legibles;
4. que `current_version` corresponde a una revisión existente;
5. que workspaces/membresías conservan sus relaciones;
6. que auditoría y operaciones no tienen referencias rotas.

## Control optimista

Cada guardado de proyecto utiliza `expectedVersion`.

El servidor solo incrementa `current_version` si la versión almacenada coincide. Si otro cliente ha guardado antes, devuelve `projects.ErrVersionConflict` internamente y no crea una nueva revisión.

Esta garantía es la base para E4/E5; nunca se debe sustituir por un update ciego.

## Incidente de migración

Si una migración falla:

- no arrancar tráfico sobre una instancia parcialmente migrada;
- conservar logs del fallo;
- corregir mediante una nueva migración cuando sea posible;
- si se produjo una modificación irreversible incorrecta, restaurar desde un backup validado;
- no modificar manualmente `schema_migrations` salvo procedimiento de recuperación documentado.

## Revisión previa a escritura remota

E4 no debe activar `remoteProjectWrites=true` hasta que exista evidencia de:

- backup reciente;
- restore probado;
- autenticación activa;
- autorización negativa probada;
- límites de tamaño y rate limiting;
- auditoría;
- tratamiento explícito de conflictos de versión.
