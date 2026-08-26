# Guía paso a paso: probar Acero-V1

Este documento está pensado para que lo pueda seguir alguien **sin
experiencia previa en programación**. Cada paso explica qué hacer y qué
deberías ver si salió bien. Al final hay una sección para anotar cualquier
problema, de forma que sea fácil de reportar y arreglar.

No necesitas entender el código. Solo necesitas seguir los pasos en orden y
anotar qué pasa en cada uno.

---

## Antes de empezar: qué vas a necesitar

- Un computador (Windows o Mac). No sirve un celular para esto.
- Conexión a internet.
- 30–45 minutos sin apuro, la primera vez.
- Los datos de acceso a la base de datos (te los debe pasar quien administra
  el proyecto — es un texto largo que empieza con `postgresql://...`).

---

## Paso 1: Instalar Node.js

Node.js es el programa que permite correr esta aplicación en tu
computador. Si no sabes si ya lo tienes instalado, hazlo igual — no hace
daño instalarlo de nuevo.

1. Entra a **https://nodejs.org**
2. Descarga la versión que dice **"LTS"** (es la recomendada, más estable).
3. Ábrela e instala con las opciones por defecto (siguiente, siguiente,
   siguiente).

**Cómo confirmar que quedó instalado:**

- **Windows**: busca "Símbolo del sistema" o "PowerShell" en el menú de
  inicio y ábrelo.
- **Mac**: busca "Terminal" con Spotlight (Cmd + Espacio) y ábrelo.

En esa ventana negra que se abre (se llama "terminal" o "consola"), escribe
exactamente esto y presiona Enter:

```
node --version
```

Si ves algo como `v20.11.0` o similar, quedó instalado correctamente. Si
sale un error, vuelve a instalar Node.js y reinicia el computador.

Deja esta ventana de terminal abierta — la vas a usar en los siguientes
pasos.

---

## Paso 2: Descargar el proyecto

Pregunta a quien te pasó este documento cuál de las dos opciones aplica:

### Opción A — Te dieron un archivo .zip

1. Descarga el archivo `.zip` que te enviaron.
2. Haz doble clic para descomprimirlo (o botón derecho → "Extraer todo" en
   Windows, o doble clic en Mac).
3. Anota en qué carpeta quedó (por ejemplo, tu Escritorio).

### Opción B — Te dieron un link de GitHub

1. Entra al link del repositorio.
2. Botón verde **"Code"** → **"Download ZIP"**.
3. Descomprime igual que en la Opción A.

---

## Paso 3: Abrir la carpeta del proyecto en la terminal

En la misma ventana de terminal del Paso 1, tienes que "pararte" dentro de
la carpeta del proyecto. La forma más fácil:

1. Escribe `cd ` (con un espacio después, sin presionar Enter todavía).
2. Arrastra la carpeta del proyecto (la que descomprimiste) directamente
   hacia la ventana de la terminal. Esto va a escribir automáticamente la
   ruta completa.
3. Presiona Enter.

Para confirmar que estás en el lugar correcto, escribe:

```
dir
```
(en Windows) o
```
ls
```
(en Mac)

Deberías ver una lista de archivos que incluye `package.json`, `server.ts`,
una carpeta `src`, entre otros. Si no ves eso, repite el paso 3 arrastrando
la carpeta correcta.

---

## Paso 4: Configurar los datos de acceso

1. Dentro de la carpeta del proyecto, busca el archivo llamado
   **`.env.example`** (ábrelo con el Bloc de notas / TextEdit).
2. Guarda una copia de ese mismo archivo, pero con el nombre **`.env`**
   (sin ".example" al final).
   - En Windows: copia el archivo, pégalo, y renombra la copia a `.env`
   - En Mac: lo mismo, con Cmd+C / Cmd+V y luego renombrar

   > Si Windows no te deja poner un punto al inicio del nombre, escribe el
   > nombre completo `.env.` (con un punto al final también) — Windows lo
   > guarda correctamente aunque en la lista no se vea el punto final.

3. Abre el archivo `.env` recién creado con el Bloc de notas.
4. Reemplaza estas dos líneas con los datos reales que te hayan pasado:

```
DATABASE_URL=postgresql://usuario:password@host:5432/postgres
JWT_SECRET=cambia_esto_por_un_texto_largo_y_aleatorio
```

   - `DATABASE_URL`: pégala tal cual te la pasaron.
   - `JWT_SECRET`: puede ser cualquier texto largo inventado (letras y
     números mezclados, mientras más largo mejor). No necesitas que
     signifique nada.

5. Guarda el archivo y ciérralo.

---

## Paso 5: Instalar lo que la aplicación necesita

Vuelve a la ventana de terminal (donde ya estabas parado dentro de la
carpeta del proyecto) y escribe:

```
npm install
```

Presiona Enter y espera. Esto puede tardar unos minutos — va a mostrar
mucho texto pasando, es normal. Al final debería quedar quieto y devolverte
el cursor para escribir de nuevo, sin la palabra "error" en rojo.

> Si aparece la palabra **"error"** en rojo al final, copia todo el texto
> que salió y pásamelo — no sigas al paso siguiente todavía.

---

## Paso 6: Revisar que el código no tenga errores

Este paso es clave y muy rápido. Escribe:

```
npm run lint
```

Esto revisa TODO el proyecto de una vez y te dice si hay algo mal escrito
en el código, antes de intentar abrir la aplicación.

- Si no muestra nada raro (o dice algo como "no errors found" / no aparece
  texto en rojo), quedó bien — pasa al Paso 7.
- Si aparece una lista de errores (texto en rojo, con nombres de archivo y
  números de línea), **copia toda esa lista tal cual salió** y guárdala
  para el reporte final. Igual puedes seguir probando lo demás, pero avisa
  de estos errores.

---

## Paso 7: Levantar la aplicación

Escribe:

```
npm run dev
```

Esto deja la aplicación corriendo. La ventana de terminal va a quedar
"trabajando" (no la cierres mientras estés probando). Debería aparecer un
mensaje indicando una dirección web, algo como:

```
Servidor corriendo en http://localhost:3000
```

Abre tu navegador (Chrome, Edge, el que uses normalmente) y entra a esa
dirección (usualmente `http://localhost:3000`).

Deberías ver la pantalla de inicio de sesión de la aplicación.

> **Para cerrar la aplicación** cuando termines de probar: vuelve a la
> ventana de la terminal y presiona `Ctrl + C`.

---

## Paso 8: Probar la aplicación

Inicia sesión con el usuario que te hayan indicado. A partir de aquí, ve
marcando cada casillero según vayas probando. No hace falta que lo hagas
todo en una sola sesión.

### 8.1 — Lo básico

- [ ] Pude iniciar sesión sin error
- [ ] El menú de arriba muestra varias pestañas y todas abren algo (ninguna
      queda en blanco)

### 8.2 — Visualizador de planos CNC

- [ ] Entré a la pestaña de CNC
- [ ] Subí un archivo `.nc1` de prueba y se vio el dibujo de la pieza
- [ ] Las perforaciones (agujeros) se ven en el lugar correcto sobre la
      pieza, no fuera de ella ni amontonadas

### 8.3 — Cubicación & Bodega

- [ ] Entré a la pestaña "Cubicación & Bodega"
- [ ] Pude importar una lista de materiales (BOM) de prueba
- [ ] Al calcular el pre-anidado (corte de barras), me mostró un resultado
      con sentido (no números en blanco ni "NaN")
- [ ] Pude guardar el proyecto y luego lo encontré en "Historial"

### 8.4 — Reportes

- [ ] Entré a la pestaña "Reportes" y cargó sin quedarse pegada
- [ ] Descargué el reporte de inventario en PDF y se abrió bien
- [ ] Descargué el reporte de inventario en Excel y se abrió bien

### 8.5 — Integración con Softland

- [ ] Subí el archivo de catálogo de Softland y se leyó correctamente
      (te muestra cuántos productos encontró)
- [ ] Generé una Guía de Entrada de prueba con 2 o 3 materiales inventados
      y el Excel se descargó con columnas que tienen sentido
- [ ] Al confirmar "actualizar inventario", el stock del material subió

### 8.6 — Planchas, pernos y consumo por proyecto

- [ ] Agregué una plancha de prueba con su número de colada
- [ ] Agregué un perno de prueba
- [ ] Registré un consumo parcial de una plancha (por ejemplo 0.3) y el
      stock bajó correctamente (si tenía 1.0, debería quedar en 0.7)

### 8.7 — Rentabilidad

- [ ] Entré a la sección de Rentabilidad por Proyecto y los números que
      muestra tienen sentido comparados a mano

---

## Cómo darme el feedback (para que sea rápido de arreglar)

Por cada problema que encuentres, necesito estos 4 datos. Si me falta
alguno, probablemente te voy a tener que preguntar de nuevo y se pierde
tiempo:

1. **En qué paso pasó** (ej. "Paso 8.5, al subir el catálogo de Softland")
2. **Qué esperabas que pasara** (ej. "que me mostrara la lista de
   productos")
3. **Qué pasó en realidad** (ej. "la página quedó en blanco" / "salió un
   mensaje de error")
4. **El texto exacto del error**, si apareció alguno. Para copiarlo bien:
   - Si el error salió en el navegador: presiona F12 (o clic derecho →
     "Inspeccionar" → pestaña "Console"), ahí suele aparecer el texto real
     del error en rojo. Cópialo completo.
   - Si el error salió en la terminal: selecciona el texto con el mouse y
     cópialo completo.
   - Si no hay texto (solo se ve mal visualmente), una captura de pantalla
     sirve igual.

No hace falta que entiendas el error — con el texto exacto y en qué paso
pasó, es suficiente para poder revisarlo.
