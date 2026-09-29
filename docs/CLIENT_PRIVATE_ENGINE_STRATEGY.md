# NetWizard Client Engine / Private Engine Strategy

## Objetivo

NetWizard seguirá siendo una aplicación rica ejecutada principalmente en el navegador, pero la lógica que aporta valor diferencial, requiere autoridad de servidor o debe permanecer confidencial se ejecutará en Railway.

La separación objetivo es:

```text
Browser / Client Engine
├─ UI
├─ editor visual
├─ interacción
├─ estado temporal
├─ visualización
├─ validación UX
└─ capacidades locales que aceptamos como inspeccionables

HTTPS / versioned contracts

Railway / Server
├─ auth + sesiones
├─ workspaces + permisos
├─ persistencia + revisiones
├─ colaboración + auditoría
└─ Private Engine
   ├─ routing avanzado
   ├─ generación vendor
   ├─ deployment
   ├─ validación avanzada
   ├─ optimización/simulación
   └─ futuras capacidades premium o propietarias
```

Servir los assets estáticos desde Railway no cambia esta frontera: el HTML/CSS/JS se descarga y ejecuta en el navegador. Solo el código que permanece exclusivamente fuera del directorio público y se invoca mediante API se considera privado.

## Principios no negociables

1. **El navegador es una plataforma de ejecución, no una frontera de secreto.**
   Todo JavaScript enviado al cliente debe considerarse inspeccionable.

2. **Railway contiene la autoridad y el motor privado.**
   Identidad, permisos, persistencia compartida, auditoría, secretos y algoritmos propietarios pertenecen al servidor.

3. **No duplicar lógica de dominio permanentemente.**
   Toda migración cliente -> servidor necesita contrato versionado, paridad y un plan explícito para retirar o degradar la implementación cliente.

4. **La experiencia interactiva debe seguir siendo client-first.**
   Drag/drop, zoom, canvas, paneles, filtros, selección y edición visual no deben convertirse en round-trips al servidor.

5. **Same-origin mientras aporte simplicidad.**
   En la fase actual Railway puede servir tanto frontend como API bajo el mismo origen. Esto simplifica cookies, CSRF y CORS sin trasladar la ejecución del frontend al servidor.

6. **Modo local explícito, no equivalente al modo cloud.**
   NetWizard puede conservar capacidades locales útiles, pero las funciones que deban permanecer privadas no pueden seguir teniendo una implementación completa en el bundle público una vez terminada su migración.

## Capas

### Client Engine

Responsable de:

- shell de aplicación;
- navegación;
- formularios;
- V5/canvas/topología;
- drag & drop;
- renderizado;
- filtros y búsquedas locales;
- previsualización;
- estado de edición temporal;
- import/export portable cuando no revele lógica propietaria;
- validaciones de UX;
- modo local/offline deliberadamente soportado.

El Client Engine puede conocer contratos y resultados del servidor, pero no secretos ni implementaciones privadas.

### SaaS API

Responsable de:

- OIDC y sesiones;
- usuarios internos;
- workspaces;
- roles owner/editor/viewer;
- proyectos y revisiones;
- operaciones colaborativas;
- rate limits;
- CSRF;
- auditoría;
- coordinación de los servicios privados;
- contratos versionados entre cliente y motor.

La UI nunca es autoridad para permisos.

### Private Engine

Responsable de algoritmos que:

- queramos proteger frente a inspección del navegador;
- generen configuración avanzada;
- constituyan propiedad intelectual relevante;
- requieran secretos;
- sean premium/licenciables;
- consuman recursos que queramos controlar y medir;
- deban producir un resultado auditable ligado a una revisión remota.

El Private Engine no debe aceptar proyectos arbitrarios del navegador cuando pueda cargar la revisión autorizada desde PostgreSQL.

### PostgreSQL

Fuente de verdad para:

- identidad interna;
- membresías;
- proyectos remotos;
- revisiones;
- sesiones;
- operation log;
- auditoría;
- límites distribuidos.

Auth0 u otro proveedor OIDC identifica al usuario, pero no será la base de datos de negocio de NetWizard.

## Clasificación inicial de módulos

La tabla es una dirección arquitectónica, no una orden para mover todo de una vez.

| Área/módulo | Destino objetivo | Motivo |
| --- | --- | --- |
| UI, paneles, modales, formularios | Cliente | interacción |
| V5 renderer / scene / controls | Cliente | renderizado |
| drag controller / location transactions | Cliente | interacción inmediata |
| graph viewer / visualización | Cliente | presentación |
| i18n | Cliente | presentación |
| schema portable / import-export | Cliente + servidor | interoperabilidad y validación |
| routing plan avanzado | Privado tras transición | lógica técnica valiosa |
| Cisco routing generator | Privado tras transición | generación propietaria |
| multivendor routing generator | Privado tras transición | generación propietaria |
| vendor config generators | Candidato privado | generación avanzada |
| firewall edge generator | Candidato privado | generación avanzada |
| switching generator | Candidato privado | generación avanzada |
| access security generator | Candidato privado | generación avanzada |
| management generator | Candidato privado | generación avanzada |
| HA services generator | Candidato privado | generación avanzada |
| change-set / incremental generators | Candidato privado | deployment |
| deployment runbook / bundle | Candidato privado | deployment |
| architecture validator | Mixto | UX local + análisis profundo privado |
| production gate | Mixto | prechecks locales + autoridad cloud |
| resilience / failure simulation | Probable privado | análisis avanzado |
| traffic capacity | Mixto / a estudiar | coste vs valor propietario |
| VLSM planner | A estudiar | utilidad offline vs propiedad intelectual |
| reporting | Mixto | render local, análisis/firma server-side |

## Estados de una migración

Una capacidad sensible pasa por cuatro estados:

### 0. Pública

La implementación vive únicamente en el bundle del navegador.

### 1. Duplicada de transición

Existe una implementación/worker privado con pruebas de paridad, pero la implementación del navegador sigue publicada para preservar compatibilidad.

Este estado debe ser temporal.

### 2. Cloud autoritativo

La UI productiva usa el endpoint privado. La implementación cliente completa deja de ser necesaria para la experiencia cloud.

### 3. Privada

El código sensible se elimina del artefacto público de producción y solo existe en el Private Engine. El modo local conserva únicamente una capacidad degradada o no ofrece esa función.

La migración no se considera terminada hasta alcanzar el estado 3 para las capacidades que realmente queramos proteger.

## Contrato de migración

Antes de mover cualquier módulo al Private Engine deben existir:

1. contrato I/O versionado;
2. snapshot/revisión de entrada claramente definido;
3. tests de paridad;
4. autorización y auditoría;
5. límites de tiempo/tamaño;
6. estrategia de error y fallback;
7. decisión del comportamiento local;
8. test que demuestre que el código sensible ya no está presente en el artefacto público cuando se alcanza estado 3.

## Orden inmediato de trabajo

### A. Fijar esta arquitectura

Este documento y `BACKEND_BOUNDARIES.md` pasan a ser la referencia para nuevas capacidades.

### B. Activar OIDC/Auth0 en producción

Auth0 será inicialmente el proveedor, pero NetWizard dependerá del estándar OIDC y mantendrá los usuarios/roles de negocio en PostgreSQL.

Criterio de salida:

- login real en Railway;
- callback HTTPS;
- sesión server-side;
- cookie segura;
- `/api/auth/me` funcional;
- logout CSRF;
- capacidades remotas activas.

### C. Completar la migración de routing

El routing avanzado ya dispone de worker privado y contrato.

Implementación cloud:

- la UI puede abrir un proyecto SaaS mediante `projectId` explícito o el parámetro `?projectId=...`;
- el contexto remoto `{projectId,currentVersion,etag}` vive solo en memoria y no se serializa en el snapshot portable;
- antes de generar routing privado, la UI sincroniza el snapshot actual con `PUT /api/projects/{projectID}` usando `expectedVersion`, CSRF e `If-Match`;
- tras una sincronización válida invoca `POST /api/projects/{projectID}/private/routing` sobre esa misma revisión;
- conflictos 409/412 bloquean la generación y obligan a recargar el proyecto remoto;
- el modo local/source mantiene su generación inspeccionable como compatibilidad deliberada;
- el artefacto Docker de producción no publica los generadores completos de routing.

Routing es el primer caso que alcanza flujo cloud autoritativo con frontera privada en el artefacto Docker de producción.

### Estado de routing en producción

El artefacto Docker de producción no publica ya los módulos completos de routing avanzado:

- `netwizard-routing-plan.js`;
- `netwizard-cisco-routing-generator.js`;
- `netwizard-multivendor-routing-generator.js`;
- sus dos integraciones de pipeline.

El worker privado se construye antes de retirar esos módulos y queda exclusivamente en `/app/private/routing-worker.cjs`, fuera de `NETWIZARD_STATIC_DIR`. El entrypoint fuente conserva temporalmente los módulos para desarrollo y modo local/offline.

La UI cloud dispone de una capa explícita de contexto remoto en memoria. `projectId`, `currentVersion` y `ETag` proceden de la API SaaS y nunca se inventan ni se guardan dentro del snapshot portable. El routing privado se ofrece como una acción asíncrona separada del pipeline local síncrono para no romper exportaciones/offline.

### D. Deployment planning privado

El segundo bloque privado empieza por la parte pura del deployment, no por el empaquetador ZIP completo:

- `change-set`;
- `incremental-generators`;
- `deployment-runbook`.

El backend carga la revisión autoritativa desde PostgreSQL y ejecuta esos tres módulos en `deployment-worker.cjs`, fuera del directorio público. El contrato `netwizard-private-deployment-plan-v2` devuelve plan, runbook, rollback, resúmenes y artefactos incrementales.

Estado actual: **generación objetivo autoritativa en servidor**. El Private Engine genera las configuraciones objetivo de `cisco_ios`, `cisco_asa`, `juniper_junos`, `huawei_vrp`, `mikrotik_routeros`, `fortinet`, `pfsense`, `aruba_aoss`, UniFi, Omada, Galgus, Windows y Linux. `configPaths` se derivan siempre en servidor.

El endpoint de deployment ya no acepta `desiredConfigs` ni `configPaths`; recibe solo `expectedVersion`. El worker tampoco acepta esos campos si se invoca directamente. El snapshot sigue cargándose exclusivamente desde PostgreSQL.

El ZIP local continúa como ensamblador compatible/offline; esta compatibilidad no rebaja la autoridad del flujo cloud.

### E. Consumo cloud del deployment privado

La UI cloud sincroniza primero la revisión editable con `PUT /api/projects/{projectID}` y, sobre la versión resultante, invoca `POST /api/projects/{projectID}/private/deployment-plan` con el contrato revision-only v2.

Las salidas del Private Engine —runbook, rollback, checklist, resúmenes y artefactos de configuración/incrementales— permanecen derivadas y fuera del snapshot. La UI permite inspeccionarlas, copiarlas o descargarlas sin reintroducir generación sensible en el navegador.

### E.1. Generación privada self-hosted

El despliegue Docker puede activar un modo privado self-hosted sin PostgreSQL ni OIDC mediante una frontera distinta del SaaS.

Requisitos:

- `NETWIZARD_SELF_HOSTED_PRIVATE=true`;
- `NETWIZARD_PRIVATE_SERVICE_KEY` de al menos 32 bytes, reservado al servidor;
- `NETWIZARD_SELF_HOSTED_PRIVATE_TOKEN` de al menos 32 bytes y **distinto** de la service key;
- `NETWIZARD_PRIVATE_DEPLOYMENT_WORKER` configurado;
- self-hosted y OIDC son modos mutuamente excluyentes.

El token de operador solo abre una sesión local. El backend emite una cookie HttpOnly + SameSite=Strict y un token CSRF; el token de operador no se persiste en el proyecto ni se reutiliza como clave del motor.

`POST /api/private/self-hosted/deployment-plan` acepta exclusivamente `{snapshot}`. Antes de ejecutar el worker:

1. exige sesión privada válida y CSRF;
2. exige petición same-origin y cabecera `X-NetWizard-Private-Request`;
3. aplica rate limit en memoria;
4. limita el tamaño;
5. valida JSON y schema 3.50 con `projects.ValidateSnapshot`;
6. rechaza campos cliente como `desiredConfigs` o `configPaths`.

A diferencia del SaaS, este modo no dispone de una revisión PostgreSQL autoritativa: el snapshot actual del navegador es la entrada de diseño porque el propio operador self-hosted controla esa instancia. Esta excepción no modifica la regla SaaS de cargar siempre la revisión autorizada desde almacenamiento remoto.

Los generadores vendor permanecen exclusivamente en `deployment-worker.cjs`; el navegador solo contiene el transporte hacia el endpoint.

### F. Frontera de generadores en el navegador de producción

El perfil Docker/SaaS deja de publicar los módulos especializados cuya lógica ya ejecuta el Private Engine:

- renderer multivendor principal;
- switching y firewall edge;
- access-security;
- management;
- HA/services;
- sus planes e integraciones browser.

El manifiesto sigue cargándolos en source/Pages, por lo que desarrollo y modo local/offline conservan el pipeline completo. El perfil de producción mantiene `netwizard-config-pipeline.js` como envoltorio estable, pero el runtime ya no exige renderers/stages especializados cuando detecta ese perfil.

La preparación de producción deriva toda la exclusión del manifiesto y elimina también los archivos físicos de `/app/public/js`. CI valida que ningún módulo público dependa de uno privado.

### G. Generador histórico extraído

El antiguo `genConfig` base y sus renderers Cisco IOS/ASA, Junos, Aruba, pfSense, FortiGate, Windows y Linux dejan de estar incrustados en `netwizard.js`. Viven en `netwizard-legacy-config-generator.js`, marcado `production:false`.

- source/Pages/offline cargan ese módulo y mantienen compatibilidad con generación local;
- Docker/SaaS no publica el módulo;
- `netwizard.js` conserva únicamente un adaptador estable;
- si el módulo no existe, el adaptador devuelve un estado explícito de generación local no disponible;
- exportación local TXT/por dispositivo, ZIP local y preflight incremental quedan bloqueados en el navegador SaaS para evitar tratar ese estado como configuración real;
- el flujo cloud autorizado continúa por Private Deployment Plan v2.

Con esta separación, la lógica de generación clasificada como propietaria deja de residir en el artefacto browser productivo salvo utilidades genéricas aceptadas explícitamente como inspeccionables.

### H. Production Gate privada sobre artefactos

El deployment privado ejecuta una puerta adicional `netwizard-private-production-gate-v1` dentro del worker. La decisión combina:

- Production Gate estricta y extensión arquitectónica sobre la revisión remota autoritativa;
- hardening vendor y validadores de L1/L2/L3, DHCP, políticas, cableado, PoE y arquitectura disponibles en servidor;
- cobertura de una configuración privada por dispositivo;
- `configSources=device:private`;
- rutas de artefacto relativas, seguras y no duplicadas;
- rechazo de placeholders/fallbacks no ejecutables;
- presencia de change set, incremental plan, deployment plan, runbook, rollback y checklist.

`ok=true` ya no debe interpretarse como certificación de producción: solo indica que el plan se construyó. `productionReady=true` exige `productionStatus=ready`; `review` y `blocked` se muestran como tales en la UI cloud.

Los validadores se requieren estáticamente desde el worker para que esbuild los incluya dentro de `deployment-worker.cjs`; el gate privado no depende de fuentes JS públicas en runtime.

### I. Siguiente bloque privado

Orden recomendado:

1. revisar simulación/resiliencia para decidir qué resultados deben incorporarse a la certificación privada;
2. cerrar checklist de publicación y seguridad;
3. pasar a mejoras de producto/UX salvo bloqueo verificado.

La selección se hará por relación entre valor intelectual, facilidad de aislamiento y dependencia del modo offline.

## Identidad y portabilidad del proveedor

NetWizard no debe depender semánticamente de Auth0.

El proveedor externo aporta:

- issuer;
- subject;
- email/nombre cuando estén disponibles;
- prueba criptográfica de identidad mediante OIDC.

NetWizard conserva internamente:

- user ID;
- workspaces;
- memberships;
- roles;
- proyectos;
- auditoría;
- planes/entitlements futuros.

Si Auth0 deja de ser conveniente, la sustitución se aborda en la capa OIDC sin reescribir el Private Engine ni el modelo de negocio.

## Coste y ejecución

Mantener UI y visualización en cliente tiene dos efectos buscados:

- baja latencia de interacción;
- menor consumo de CPU del backend.

El servidor debe ejecutar trabajo cuando aporta autoridad, privacidad o valor central, no por defecto.

La métrica de éxito no es maximizar el porcentaje de código server-side. Es maximizar la protección del valor relevante manteniendo una aplicación rápida y rica en cliente.

## Flujos de producto: Inventario y Diseño

La separación de ejecución Client Engine / Private Engine se complementa con dos flujos de trabajo de producto definidos en [INVENTORY_DESIGN_STRATEGY.md](./INVENTORY_DESIGN_STRATEGY.md):

- **Inventario / As-Built**: captura descriptiva de racks, equipos, puertos, alimentación y conexiones; principalmente Client Engine y apto para offline.
- **Diseño / To-Be**: planificación, validación, generación y deployment; usa Client Engine para interacción y Private Engine para lógica propietaria.

Ambos comparten las entidades canónicas del proyecto para evitar duplicar dispositivos, puertos o enlaces. Los proyectos pueden incluir además modelos de dispositivo personalizados locales al proyecto cuando el equipo no exista en el catálogo global.

## Criterio para publicar NetWizard

La aplicación puede considerarse preparada para publicación con protección razonable cuando:

1. toda lógica que hayamos clasificado como propietaria y sensible se ejecute únicamente en Private Engine;
2. la imagen pública no incluya sus fuentes, bundles ni source maps;
3. las capacidades restantes del navegador estén aceptadas explícitamente como inspeccionables;
4. CI compruebe que una regresión no vuelva a publicar módulos privados;
5. autenticación, autorización, auditoría y límites de los endpoints privados estén activos.
