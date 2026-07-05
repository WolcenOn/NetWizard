# NetWizard v2.8.1 · Tree Layout Hotfix

Esta versión corrige la pantalla en blanco detectada en v2.8.

## Causa
La v2.8 modificaba accidentalmente `js/netwizard.js` al intentar enrutar enlaces físicos. Esa modificación rompía la función original `drawV5()` y dejaba la V5 sin renderizar aunque los datos siguieran existiendo.

## Corrección
- Se parte de la base estable v2.7.
- No se modifica `js/netwizard.js`.
- El nuevo layout se implementa solo en `js/netwizard-v5-layout-manager.js`.
- Se añade el modo `Árbol · bloques por puerto`.
- Cada ubicación calcula primero bloques internos: equipo de red a la izquierda y hosts asociados a la derecha en una sola columna.
- Las ubicaciones raíz se colocan por árbol de conectividad y con separación vertical garantizada.

## Próximo paso
El routing ortogonal de enlaces físicos se hará como módulo independiente y seguro, sin reescribir el motor principal V5.
