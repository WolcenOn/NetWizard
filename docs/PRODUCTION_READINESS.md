# Preparación para producción local/controlada

NetWizard puede considerarse preparado para uso local/controlado cuando se cumplen estas condiciones.

## Validaciones técnicas

1. Ejecutar unit tests:

```bash
npm test
```

2. Ejecutar comprobación sintáctica:

```bash
npm run check:syntax
```

3. Ejecutar los tests del backend Go:

```bash
go test ./...
```

4. Validar que el contenedor de producción construye:

```bash
docker build .
```

5. Instalar y ejecutar E2E:

```bash
npm run test:e2e:install
npm run test:e2e
```

El smoke test debe confirmar `NetWizardRuntime.status.ok === true`: ningún módulo requerido ausente, ningún script duplicado, puerta de arquitectura activa y todas las etapas del pipeline de configuración instaladas.

6. Abrir el proyecto real en navegador y ejecutar:

- Puerta de producción.
- Auditoría L2 avanzada.
- Auditoría capa 1.
- Validación DHCP.
- Hardening exportación vendor.
- Matriz de conectividad.
- Checklist de producción.

## Criterio de salida

- Sin errores bloqueantes en Puerta de Producción.
- Sin errores de schema/importación.
- Sin IPs duplicadas ni fuera de subnet.
- Sin DHCP que pise gateway/IPs estáticas.
- Sin VLANs críticas sin gateway o sin continuidad L2.
- Sin PoE/cableado fuera de especificación en elementos críticos.
- Sin colisiones de rack, referencias de PDU/tomas inválidas ni rutas de cableado estructurado incompletas en los elementos documentados.
- En proyectos multisede, cada subnet con gateway debe quedar asociada o inferida correctamente al borde/firewall correspondiente.
- Sin exportaciones vendor bloqueadas en modo producción.
- Todos los vendors ofrecidos por la UI generan una salida no vacía y no caen en `Sin vendor asignado`.
- Los scripts pfSense PHP deben revisarse en laboratorio contra la versión concreta de pfSense y ejecutarse únicamente con backup previo de `config.xml`.
- La vista física no sustituye la validación del JSON: racks, tomas y ubicaciones deben estar correctamente referenciados en el modelo 3.50.
- El artefacto de Pages se construye con `npm run build:pages` sin recursos locales ausentes.

## Publicación en GitHub Pages

El workflow `NetWizard CI` empaqueta y despliega Pages únicamente después de superar Quality JS, tests Go, Playwright y la construcción del contenedor. En la configuración del repositorio debe seleccionarse **GitHub Actions** como origen de Pages; no debe coexistir un despliegue independiente desde rama.

La rama `main` debe protegerse exigiendo como comprobaciones obligatorias:

- `Quality checks`
- `Go backend tests`
- `Playwright E2E`
- `Docker build`

El entorno `github-pages` puede protegerse adicionalmente para limitar despliegues a `main`.

## Alcance

Esta preparación es para ejecución local, laboratorio, formación, preventa, documentación o uso profesional controlado.

Existe un backend Go mínimo y un despliegue de contenedor, pero esto no equivale a plataforma SaaS multiusuario: todavía no hay autenticación, autorización por proyecto, persistencia remota, auditoría de usuarios ni backups de base de datos.
