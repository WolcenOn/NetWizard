# NetWizard v3.21 · Auditoría PoE

Esta versión añade una primera capa prudente de validación PoE para acercar la capa 1 a producción.

## Nuevo módulo

- `js/netwizard-poe-utils.js`

## Datos soportados

### Dispositivos

- `poeBudgetW`: presupuesto PoE total del switch/equipo.

### Puertos

- `poeMode`: `auto`, `none`, `af`, `at`, `bt`, `bt90`.
- `poeWattsMax`: capacidad máxima explícita en vatios.

### Hosts

- `poeMode`: `auto`, `yes`, `none`.
- `poeRequired`: booleano opcional.
- `poeWatts`: consumo estimado en vatios.

En modo `auto`, APs, cámaras IP y teléfonos IP se consideran cargas PoE probables.

## Validaciones añadidas

- Host PoE sin puerto físico asociado.
- Host PoE conectado a puerto que parece fibra/SFP/DAC.
- Puerto marcado sin PoE alimentando un host PoE.
- Consumo superior a capacidad del puerto.
- Carga total PoE superior al presupuesto del switch.
- Aviso si falta presupuesto total del switch.

## UI

La página de puertos incluye una tarjeta nueva:

- `⚡ PoE · Presupuesto y consumo`

Permite editar presupuestos de switches, modo/capacidad de puertos y consumo de hosts detectados.

## Prudencia

No cambia automáticamente modos de puerto ni presupuestos. Solo valida y permite editar datos PoE explícitos.
