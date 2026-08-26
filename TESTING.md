# Guía de primera prueba

Todo lo de este documento se construyó sin poder compilar ni ejecutar nada
(el entorno de trabajo no tenía acceso a red). Está revisado a mano con
mucho cuidado, pero la primera pasada real la vas a hacer tú. Sigue este
orden — está pensado para encontrar problemas grandes primero, antes de
perder tiempo en detalles.

## 0. Antes de arrancar

```bash
cp .env.example .env
# edita .env con tu DATABASE_URL real y un JWT_SECRET nuevo

npm install
npm run lint      # <- ESTO PRIMERO. Corre tsc --noEmit y te muestra
                   #    TODOS los errores de tipos del proyecto de una vez,
                   #    sin necesidad de ir clickeando pantalla por pantalla.
```

Si `npm run lint` marca errores: cópiamelos tal cual salen (archivo + línea
+ mensaje) y los arreglo. Es mucho más rápido resolverlos todos juntos acá
que uno por uno mientras navegas la app.

Recién cuando `npm run lint` salga limpio (o con errores que ya entendemos):

```bash
npm run dev
```

## 1. Login y base (lo mínimo para que exista la app)

- [ ] El servidor arranca sin errores en la consola
- [ ] Puedes loguearte con el usuario admin (o el que ya tenías)
- [ ] Las pestañas de navegación cargan sin pantalla en blanco

## 2. Visualizador CNC (lo primero que pediste)

- [ ] Sube `k6p4_A.nc1` (la plancha) → el contorno se ve como el pentágono
      con la esquina cortada, no un rectángulo ni una línea rara
- [ ] Sube `K6DX21.nc1` (el ángulo) → la vista 3D muestra un ángulo, no una
      viga I genérica
- [ ] Las perforaciones aparecen en la posición correcta en ambos casos

## 3. Cubicación & Bodega (la app fusionada)

- [ ] La pestaña nueva aparece en el menú principal
- [ ] Puedes importar un BOM de prueba y ver los grupos de perfiles
- [ ] El pre-anidado corre sin error
- [ ] Guardar un proyecto de cubicación funciona (y aparece en "Historial")

## 4. Reportes — básico

- [ ] La pestaña "Reportes" carga sin error (trae inventario/proyectos desde
      el servidor)
- [ ] Exportar inventario a PDF y a Excel descarga archivos que abren bien

## 5. Catálogo e integración Softland

- [ ] Subir `IWdell506320260708083608.XLS` (o su versión .xlsx) como catálogo
      → debería leer los productos y no romperse con las filas de título
- [ ] La comparación catálogo-vs-inventario se descarga correctamente
- [ ] Generar una Guía de Entrada de prueba (2-3 líneas) → el Excel resultante
      tiene las 31 columnas en el mismo orden que tu plantilla real
      (`listad.xlsx`, hoja "Hoja2")
- [ ] Al confirmar "actualizar inventario", el stock sube y (si es plancha)
      queda registrada la colada

## 6. Planchas, pernos y consumo por proyecto

- [ ] Agregar una plancha con colada funciona y aparece en la lista
- [ ] Agregar un perno (unidad entera) funciona
- [ ] Registrar consumo de 0.3 de una plancha descuenta correctamente
      (revisa que quede 0.7 si partías con 1.0)
- [ ] Si la plancha tiene 2+ coladas, el formulario te obliga a elegir cuál

## 7. Rentabilidad por Proyecto

- [ ] Vincular un proyecto de cubicación a un presupuesto no rompe nada
- [ ] Los números de costo real tienen sentido (compáralos a mano con 1-2
      materiales conocidos, antes de confiar en el reporte completo)

## 8. Guía de Salida (marcada como experimental — revisar con más cuidado)

- [ ] Se genera el Excel sin error
- [ ] **No la subas a Softland todavía** — primero compárala con la
      plantilla real de egreso si tu administrador de Softland te la
      consigue

## 9. Respaldo de base de datos

- [ ] Configura el secret `DATABASE_URL` en GitHub (ver `BACKUP.md`)
- [ ] Lanza el workflow manualmente ("Run workflow") y confirma que el
      artefacto se genera y pesa algo razonable (no 0 KB)

---

## Si algo falla

Mándame: qué paso de esta lista falló, el mensaje de error completo (de la
consola del navegador si es algo visual, o de la terminal si es el
servidor), y si puedes, un screenshot. Con eso reproduzco el problema más
rápido que con una descripción general tipo "no funciona".
