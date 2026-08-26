# Contexto del proyecto — leer antes de tocar código

Este proyecto es la fusión de dos apps: **Acero-V1** (cálculo de piezas de
acero, visualizador CNC de archivos DSTV/.nc1, catálogo de precios) e
**Inventario-y-Cubicación** (importación de BOM, empalmes, pre-anidado de
cortes, inventario de bodega), más una integración con **Softland ERP**
(on-premise, sin API pública) construida a partir de archivos reales que
compartió el usuario.

**TODO lo que hay en este repo se escribió en un entorno sin acceso a red**
(no se pudo correr `npm install`, `npm run dev` ni `tsc` ni una sola vez).
Se validó a mano: revisión de tipos línea por línea, balance de llaves,
simulación de lógica en Node por separado. Es decir: la arquitectura y las
reglas de negocio están bien pensadas, pero **puede haber errores de
compilación reales que nunca se probaron**. Trata esto como la razón de ser
de tu primera sesión: correr `npm run lint` (que es `tsc --noEmit`) y
arreglar lo que salga, antes de asumir que algo "no sirve".

## Primer comando a correr, siempre

```bash
npm install
npm run lint    # tsc --noEmit — muestra TODOS los errores de tipos de una
npm run dev
```

Si `npm run lint` marca errores, arréglalos ahí antes de tocar nada más —
es mucho más eficiente que perseguir errores uno por uno en el navegador.

## Estructura relevante

- `server.ts` — backend Express + Postgres (Supabase). Todas las tablas se
  crean solas al arrancar (`initDatabase()`), no hace falta migrar nada a mano.
- `src/inventario/` — el módulo "Cubicación y Bodega" portado desde la app
  original. Los componentes de `src/inventario/components/` son casi
  verbatim del proyecto original (poco tocados, riesgo bajo). Los tipos en
  `src/inventario/types.ts` sí se extendieron bastante (ver reglas de
  negocio abajo).
- `src/components/ReportsView.tsx` — el módulo de Reportes, construido
  100% en esta sesión (es el archivo más grande y con más lógica nueva,
  candidato #1 a revisar si algo falla ahí).
- `src/components/SoftlandMaterialsSection.tsx` — gestión de planchas/pernos
  y consumo por proyecto.
- `src/utils/softland*.ts` — todo lo relacionado a Softland (parsers,
  exportadores, reconciliación).

## Reglas de negocio confirmadas por el usuario (NO son suposiciones mías)

- **Pernos**: se descuentan por unidad entera.
- **Perfiles**: se descuentan por unidad entera (barras completas).
- **Planchas**: se descuentan por FRACCIÓN de plancha completa (ej. usar
  30% de una plancha = descontar 0.3). Admiten decimales en el stock.
- **Planchas llevan colada/talla obligatoria** al ingresar a bodega (columna
  real "Partida o Talla" de Softland) — es la trazabilidad de certificado
  de material. Si una plancha tiene 2+ coladas en stock, el consumo debe
  indicar de cuál se descuenta.
- **Los retazos (offcuts) NUNCA se reportan a Softland** — es un concepto
  100% interno de la app. Cualquier exportador hacia Softland debe usar
  solo `standardBarsCount`, nunca sumar `offcuts`.
- **Cubicaciones "reales" vs "teóricas"** (`BOMProject.esReal`): una
  cubicación teórica es una cotización/estimación que puede no ejecutarse
  nunca. El informe mensual (`src/utils/monthlyReport.ts`) las mantiene en
  totales completamente separados — nunca se suman entre sí, ni en pantalla
  ni en el Excel exportado (hojas distintas).

## Sobre la integración Softland — qué es real y qué es experimental

- **Catálogo de productos** (`softlandCatalogImporter.ts`): parser
  construido y validado contra un archivo real del usuario
  (`IWdell...XLS`, el "Informe de Productos Paramétrico"). Confiable.
- **Guía de Entrada** (`softlandEntradaExport.ts`): las 31 columnas se
  copiaron literalmente de una plantilla real que el usuario ya usa
  (`listad.xlsx`, hoja "Hoja2"). Confiable.
- **Guía de Salida** (`softlandSalidaExport.ts`): construida **por
  simetría** con la de Entrada, sin haber visto un archivo real de egreso.
  Está marcado como experimental en el propio código y en el Excel que
  genera. **No asumas que el layout es correcto** — si el usuario consigue
  la plantilla real, hay que reconstruir este archivo desde cero con esos
  datos, igual como se hizo con la de Entrada.
- Softland on-premise no tiene API pública — toda la integración es vía
  Excel (exportar/importar), a propósito, no es una limitación temporal.

## Qué falta (pendiente, priorizado por el usuario)

1. ~~Guía de Salida~~ (hecha en versión experimental, falta verificar)
2. ~~Rentabilidad por proyecto~~ (hecha)
3. ~~Conectar Compras → Guía de Entrada en un paso~~ (hecha)
4. Solidez del servidor: hecha la parte de validación de inputs y respaldo
   automático (`.github/workflows/db-backup.yml` + `BACKUP.md`). Falta
   notificaciones (no hay infraestructura de correo en el proyecto — no
   inventar credenciales SMTP, preguntar primero).

## Cómo darme (al usuario) feedback si algo falla

Ver `GUIA_DE_PRUEBA.md` / `TESTING.md` en la raíz del proyecto — tienen la
checklist completa de qué probar y en qué orden.
