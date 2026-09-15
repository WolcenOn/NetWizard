# Escenarios de referencia 3.50

Los cuatro proyectos JSON son contratos funcionales, no solo datos de demostración. `production-scenarios.json` declara para cada uno:

- el resultado esperado de la puerta en modo producción estricto;
- los únicos avisos aceptados y documentados;
- los dispositivos cuya configuración debe generarse;
- firmas mínimas que identifican una salida válida por fabricante.

`ready` significa que la puerta no encuentra avisos ni bloqueos. `review` se admite únicamente cuando todos los avisos aparecen en `allowedWarningCodes`; nunca admite errores bloqueantes.

La suite unitaria valida schema, referencias y criterios de salida. Playwright importa los mismos archivos en el navegador publicado, ejecuta la puerta real, genera la configuración de cada equipo y comprueba también la documentación.
