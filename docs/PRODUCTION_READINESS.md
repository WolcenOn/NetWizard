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

3. Instalar y ejecutar E2E:

```bash
npm run test:e2e:install
npm run test:e2e
```

El smoke test debe confirmar `NetWizardRuntime.status.ok === true`: ningún módulo requerido ausente, ningún script duplicado, puerta de arquitectura activa y todas las etapas del pipeline de configuración instaladas.

4. Abrir el proyecto real en navegador y ejecutar:

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
- Sin exportaciones vendor bloqueadas en modo producción.
- Todos los vendors ofrecidos por la UI generan una salida no vacía y no caen en `Sin vendor asignado`.
- El artefacto de Pages se construye con `npm run build:pages` sin recursos locales ausentes.

## Publicación en GitHub Pages

El workflow `NetWizard CI` empaqueta y despliega Pages únicamente después de superar `quality` y `e2e`. En la configuración del repositorio debe seleccionarse **GitHub Actions** como origen de Pages; no debe coexistir un despliegue independiente desde rama.

La rama `main` debe protegerse exigiendo como comprobaciones obligatorias:

- `Quality checks`
- `Playwright E2E`

El entorno `github-pages` puede protegerse adicionalmente para limitar despliegues a `main`.

## Alcance

Esta preparación es para ejecución local, laboratorio, formación, preventa, documentación o uso profesional controlado.

No equivale a plataforma SaaS multiusuario: no hay backend, autenticación, roles, auditoría de usuarios, backups centralizados ni despliegue cloud endurecido.
