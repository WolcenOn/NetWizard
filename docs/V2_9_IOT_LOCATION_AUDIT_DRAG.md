# NetWizard v2.9 · IoT location + auditoría ajustable

## Cambios principales

- Se añade `locationId`, `physicalLocation` y `locationRole` a infraestructura IoT y dispositivos IoT.
- Los selectores de ubicación IoT leen directamente las ubicaciones físicas definidas en NetWizard Pro.
- Se conserva compatibilidad con datos anteriores: si un objeto IoT no tiene ubicación, se mantiene válido y se normaliza al cargar.
- V5 usa la ubicación IoT para colocar access nodes y dispositivos dentro de las cajas de ubicación cuando existe ese dato.
- Al arrastrar un nodo IoT dentro de una ubicación V5, se actualiza su ubicación física en la ficha IoT.
- La Auditoría Unificada deja de desordenarse al hacer clic: se captura la interacción y se mantiene el layout gestionado.
- La Auditoría Unificada permite mover nodos manualmente tras ordenar; las posiciones manuales se guardan en localStorage.

## Compatibilidad de datos

Los objetos antiguos siguen funcionando. Los nuevos campos son opcionales:

```json
{
  "locationId": "",
  "physicalLocation": "",
  "locationRole": ""
}
```

Si `physicalLocation` ya existe en algún objeto importado, la app intenta resolver `locationId` usando las ubicaciones físicas actuales.

## Prueba recomendada

1. Crear ubicaciones físicas en NetWizard.
2. Crear/editar un dispositivo IoT y asignar ubicación.
3. Ordenar V5 con “Árbol · bloques por puerto”.
4. Comprobar que los nodos IoT quedan dentro de la ubicación.
5. Arrastrar un IoT a otra ubicación y revisar que su ficha guarda la nueva ubicación.
6. En Auditoría Unificada, ordenar, hacer clic y arrastrar nodos para ajuste fino.
