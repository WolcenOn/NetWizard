# NetWizard Bridge API v1.2

Esta versión añade una capa de compatibilidad para futuras integraciones con IoTWizard sin modificar la lógica principal de NetWizard.

## Archivo nuevo

```text
js/netwizard-bridge.js
```

Debe cargarse después de `js/netwizard.js`:

```html
<script src="./js/netwizard.js"></script>
<script src="./js/netwizard-bridge.js"></script>
```

## Objeto global expuesto

```js
window.NetWizardBridge
```

## Métodos disponibles

### getProjectSnapshot()

Devuelve una copia profunda del estado actual de NetWizard.

```js
const snapshot = NetWizardBridge.getProjectSnapshot();
```

### makeUnifiedGraph(project?)

Convierte el proyecto actual o un proyecto pasado como argumento al modelo de grafo común preparado para IoTWizard.

```js
const graph = NetWizardBridge.makeUnifiedGraph();
```

### saveUnifiedSnapshot()

Guarda un paquete combinado de snapshot + grafo en localStorage.

```js
const payload = NetWizardBridge.saveUnifiedSnapshot();
```

Clave usada:

```text
netwizard_unified_project_v1
```

### downloadUnifiedSnapshot(filename?)

Genera y descarga un JSON con snapshot + grafo común.

```js
NetWizardBridge.downloadUnifiedSnapshot();
```

## Evento de disponibilidad

Cuando el bridge está listo, dispara:

```js
window.addEventListener('netwizard:bridge-ready', event => {
  console.log(event.detail);
});
```

## Principios de diseño

- No reescribe funciones existentes.
- No modifica el mapa visual actual.
- No cambia el almacenamiento original de NetWizard.
- No convierte el código a módulos ES todavía.
- Sirve como contrato inicial para IoTWizard.

## Modelo de grafo generado

```js
{
  schema: 'nw-unified-graph-v1',
  projectName: '...',
  segments: [],
  nodes: [],
  links: [],
  meta: {}
}
```

## Próximo paso sugerido

Crear una pequeña pantalla de depuración opcional que muestre el grafo generado, sin sustituir aún la topología actual.
