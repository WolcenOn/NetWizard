# Runbook de despliegue y rollback 3.50

El paquete de despliegue incluye un plan operativo generado desde el modelo real del proyecto. El objetivo no es automatizar la escritura sobre equipos, sino entregar una secuencia revisable y reversible antes de cualquier intervención.

## Secuenciación

El motor construye el grafo físico a partir de puertos y enlaces y ordena los dispositivos en estas fases:

1. Borde WAN y seguridad.
2. Routing, core y distribución.
3. Switching de acceso.
4. Servicios y controladores.
5. Acceso inalámbrico.
6. Otros dispositivos gestionados.

Las dependencias físicas se complementan con las relaciones controlador/AP y con las dependencias explícitas configuradas en `project.deployment.devices.<deviceId>.dependsOnDeviceRefs`. Un ciclo o una referencia inexistente bloquea la creación del paquete.

Los miembros de grupos HA o MLAG se marcan para ejecución estrictamente serial, comprobando el peer antes de avanzar. El paralelismo máximo del runbook 3.50 es siempre uno.

## Configuración opcional

```json
{
  "deployment": {
    "strategy": "staged",
    "changeTicket": "CHG-2026-0042",
    "maintenanceWindow": "2026-09-20 22:00–23:30 UTC",
    "approvalOwner": "Network Lead",
    "observationMinutes": 30,
    "validationTargets": ["https://intranet.example.test/health"],
    "devices": {
      "sw-access-01": {
        "phase": "access",
        "order": 10,
        "estimatedMinutes": 20,
        "dependsOnDeviceRefs": ["core-01"]
      }
    }
  }
}
```

Las fases admitidas son `edge`, `core`, `access`, `services`, `wireless` y `other`.

## Rollback

El runbook incorpora instrucciones específicas por fabricante, criterios de parada y una lista inversa de los dispositivos. No genera una configuración inversa ficticia: exige capturar el estado activo del dispositivo antes del cambio y restaurar ese backup mediante el mecanismo soportado por su plataforma.

El snapshot JSON incluido en el paquete representa el diseño deseado de NetWizard. No sustituye la copia de la `running-config`, `config.xml`, backup del controlador o snapshot del sistema real.

## Archivos

- `deployment/plan.json`: contrato estructurado con fases, dependencias, riesgo, duración y rutas de configuración.
- `deployment/runbook.md`: prechecks, secuencia, comprobaciones por fabricante y criterios de parada.
- `deployment/rollback-checklist.md`: reversión global y equipos ya ordenados en sentido inverso.
