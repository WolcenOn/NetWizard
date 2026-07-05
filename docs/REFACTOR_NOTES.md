# Refactor v1.1 - Notas

## Objetivo

Ordenar y comentar el código existente sin alterar comportamiento. Esta versión es deliberadamente conservadora.

## Estrategia usada

1. Mantener el HTML funcional separado de CSS y JS.
2. Mantener `netwizard.js` como script clásico.
3. Insertar cabeceras de mantenimiento por bloques funcionales.
4. No convertir a `type="module"` todavía.
5. No cambiar nombres globales ni funciones invocadas desde atributos `onclick`.

## Motivo

El NetWizard original usa muchas funciones globales llamadas desde HTML generado dinámicamente, por ejemplo botones con `onclick="..."`. Convertir directamente a módulos cambiaría el ámbito y podría romper esas llamadas.

## Próximos pasos seguros

- v1.2: extraer helpers puros sin DOM.
- v1.3: extraer storage/import/export.
- v1.4: crear adaptador de grafo en solo lectura.
- v2: preparar integración real con IoTWizard.
