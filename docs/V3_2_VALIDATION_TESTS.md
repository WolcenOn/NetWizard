# NetWizard v3.2 · Validaciones de red y tests automatizados

Esta revisión continúa sobre `v3.1_state_iot_fix` y se centra en los puntos 3 y 4 de la auditoría inicial.

## 1. Validaciones de red reforzadas

### Utilidades IP/CIDR testeables

Se añade `js/netwizard-network-utils.js`, cargado antes de `netwizard.js` desde `index.html`.

Funciones principales:

- `parseIp(ip)`
- `ip4s(number)`
- `parseCidr(cidr)`
- `ipInSn(ip, cidr)`
- `cidrOverlaps(a, b)`
- `findSubnetOverlap(candidateCidr, subnets, options)`
- `validateSubnetAssignment(input, subnets)`

El archivo está preparado para navegador clásico y para Node.js mediante `module.exports`, lo que permite testear las mismas reglas que usa la aplicación.

### Corrección de caso límite en `ipInSn`

Antes, `0.0.0.0` podía tratarse como falso porque `parseIp('0.0.0.0')` devuelve `0`.

Ahora se valida con `ip === null`, por lo que `0.0.0.0` funciona correctamente.

### Detección de subredes solapadas

La asignación manual de subred ya no solo compara CIDRs idénticos. Ahora bloquea solapamientos reales, por ejemplo:

- `10.0.0.0/24` con `10.0.0.128/25`
- `172.16.0.0/16` con `172.16.10.0/24`

También normaliza entradas como `10.0.1.10/24` a `10.0.1.0/24`.

### Validaciones de gateway

La asignación de subred comprueba:

- Gateway con formato IP válido.
- Gateway dentro del CIDR.
- Gateway no coincidente con dirección de red ni broadcast en subredes menores que /31.

### Auto-subnetting más seguro

El auto-subnetting valida cada subnet generada antes de guardarla. Si alguna se solapa con una subnet ya existente, se omite y se muestra en el resumen de validación.

## 2. Tests automatizados

Se añade:

- `package.json`
- `tests/run-tests.js`

Scripts disponibles:

```bash
npm test
npm run check:syntax
```

Cobertura inicial:

- Parsing de IP, incluyendo `0.0.0.0` y `255.255.255.255`.
- Pertenencia IP/subred.
- Normalización CIDR.
- Detección de solapamientos.
- Validación de gateway fuera de rango, red/broadcast y solapamientos.
- Carga de `netwizard-bridge.js` en un entorno simulado y verificación de que lee desde `NetWizardState` y genera nodos/enlaces IoT.

## 3. Verificación realizada

Comandos ejecutados correctamente:

```bash
npm test
npm run check:syntax
unzip -t netwizard_v3_2_validation_tests.zip
```

## 4. Siguientes pasos recomendados

La siguiente fase debería añadir pruebas E2E de navegador con Playwright para cubrir flujos reales:

1. Crear VLANs.
2. Crear subredes manuales y comprobar rechazo de solapamientos.
3. Crear IoT.
4. Exportar JSON.
5. Resetear.
6. Importar JSON.
7. Validar que red e IoT reaparecen en la interfaz.
