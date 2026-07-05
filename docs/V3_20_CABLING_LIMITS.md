# NetWizard v3.20 · Cableado físico y límites de medio

Esta versión añade una capa prudente de cableado físico a los enlaces.

## Campos nuevos en enlaces

- `medium`: `auto`, `copper`, `fiber`, `dac` o `wireless`.
- `cableType`: `cat5e`, `cat6`, `cat6a`, `cat8`, `om3`, `om4`, `os2`, `dac` o `auto`.
- `lengthM`: longitud del enlace en metros.
- `speed`: velocidad prevista (`100M`, `1G`, `10G`, etc.).
- `poeRequired`: preparado para validaciones PoE posteriores.

## Auditoría

La auditoría de capa 1 integra `NetWizardCablingUtils.validateCabling(project)` y avisa de:

- Longitudes negativas.
- Cobre/RJ45 por encima de 100 m.
- Cat6 a 10G por encima de 55 m.
- DAC por encima de 7 m.
- Incoherencias entre el medio del enlace y el tipo aparente de los puertos.
- PoE marcado en medios no cobre.

## Criterio prudente

No se bloquea automáticamente un diseño por superar una longitud recomendada; se emite aviso. Algunos entornos pueden usar transceptores, cableado o estándares concretos con límites distintos. En modo producción, estos avisos deben revisarse antes de exportar configuraciones.

## Pruebas

Se añaden tests unitarios para límites de medio y para comprobar que la auditoría física recoge avisos de longitud.
