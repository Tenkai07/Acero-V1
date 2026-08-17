# Guía de Publicación — Aceros Chile

Esta guía te lleva desde el código hasta tener la app funcionando en la web y
un archivo `.apk` instalable en Android. No necesitas instalar Android
Studio ni nada pesado en tu computador — todo se hace desde el navegador.

Vas a usar 3 servicios, todos con capa gratuita y sin pedir tarjeta de crédito
para lo básico:

| Servicio | Para qué sirve |
|---|---|
| **Supabase** | Tu base de datos (usuarios, proyectos, historial) |
| **Render** | Donde vive la app web (backend + frontend) |
| **PWABuilder** | Convierte tu web publicada en un `.apk` de Android |

El orden importa: primero la base de datos, después el hosting, y al final el APK
(porque el APK necesita la URL final de tu app ya funcionando).

---

## Paso 1 — Crear la base de datos en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Click en **New Project**. Dale un nombre (ej. `aceros-chile`), define una
   contraseña para la base de datos (**guárdala, la necesitarás**), y elige
   una región cercana (ej. São Paulo).
3. Espera 1-2 minutos a que el proyecto se cree.
4. Ve a **Project Settings → Database → Connection string**. Elige la pestaña
   **URI** y copia la cadena. Se ve así:
   ```
   postgresql://postgres:[TU-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. Reemplaza `[TU-PASSWORD]` por la contraseña que definiste en el paso 2.
   Guarda esta URL completa — es tu `DATABASE_URL`.

> No necesitas crear tablas a mano. La aplicación las crea solas la primera
> vez que arranca (incluyendo el usuario administrador inicial).

> **Nota:** el plan gratuito de Supabase pausa el proyecto si nadie lo usa
> por 7 días seguidos. No se pierde ningún dato — solo hay que entrar al
> panel de Supabase y darle "Restore" (tarda ~30 segundos). Si tu equipo usa
> la app regularmente, esto no debería pasar nunca.

---

## Paso 2 — Subir el código a GitHub

Render despliega leyendo un repositorio de GitHub.

1. Crea una cuenta gratuita en [github.com](https://github.com) si no tienes.
2. Crea un repositorio nuevo (puede ser privado), por ejemplo `aceros-chile`.
3. Sube el contenido de esta carpeta al repositorio. La forma más simple si
   no usas Git normalmente: en la página del repo, click en **uploading an
   existing file** y arrastra todos los archivos y carpetas del proyecto
   (excepto `node_modules` y `dist`, que no deberías tener igual).

   Si prefieres usar la terminal:
   ```bash
   cd carpeta-del-proyecto
   git init
   git add .
   git commit -m "Primera versión"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/aceros-chile.git
   git push -u origin main
   ```

---

## Paso 3 — Publicar el backend en Render

1. Ve a [render.com](https://render.com) y crea una cuenta gratuita
   (puedes entrar directo con tu cuenta de GitHub).
2. Click en **New +** → **Web Service**.
3. Conecta tu repositorio `aceros-chile`.
4. Configura:
   - **Name:** `aceros-chile` (o el que quieras — esto define tu URL)
   - **Region:** la más cercana
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Antes de crear el servicio, agrega las **Environment Variables**
   (sección más abajo en el mismo formulario, o después en
   **Environment** una vez creado):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena que copiaste de Supabase en el Paso 1 |
   | `JWT_SECRET` | Cualquier texto largo y aleatorio (ej. genera uno en https://generate-secret.vercel.app/32) |
   | `ADMIN_USERNAME` | El usuario con el que vas a entrar por primera vez, ej. `admin` |
   | `ADMIN_PASSWORD` | Una contraseña temporal para ese primer ingreso |
   | `ADMIN_FULL_NAME` | Tu nombre, ej. `Administrador` |
   | `NODE_ENV` | `production` |

6. Click en **Create Web Service**. El primer build tarda unos 3-5 minutos.
7. Cuando termine, Render te da una URL pública, algo como:
   ```
   https://aceros-chile.onrender.com
   ```
   Esa es la URL de tu app. Ábrela — deberías ver la pantalla de login.

> **Sobre el plan gratuito de Render:** si nadie usa la app por 15 minutos,
> el servidor "se duerme" y la primera visita después de eso tarda ~30-60
> segundos en responder mientras despierta. Las visitas siguientes son
> normales. Si esto te molesta más adelante, puedes pasar a un plan pagado
> (~$7 USD/mes) para que nunca se duerma.

---

## Paso 4 — Primer ingreso y crear a tu equipo

1. Entra a tu URL de Render con el `ADMIN_USERNAME` y `ADMIN_PASSWORD` que
   configuraste.
2. Arriba a la derecha, abre el menú de tu usuario → **Gestión de Usuarios**
   (o el botón "Usuarios" junto a tu nombre).
3. Ahí puedes crear una cuenta para cada persona de tu equipo: usuario,
   nombre, contraseña inicial y rol (**Administrador** u **Operador**).
   - **Administrador:** puede gestionar usuarios y cambiar el precio base
     de referencia.
   - **Operador:** puede usar todas las calculadoras, crear proyectos y ver
     el historial, pero no gestiona usuarios ni precios.
4. Comparte usuario y contraseña con cada persona por el canal que prefieras
   (WhatsApp, en persona, etc.). Pueden cambiar su contraseña después desde
   la app.

---

## Paso 5 — Generar el archivo APK con PWABuilder

Con tu app ya publicada (Paso 3), puedes generar el `.apk` sin instalar nada.

1. Ve a [pwabuilder.com](https://www.pwabuilder.com).
2. Pega la URL de tu app de Render (ej. `https://aceros-chile.onrender.com`)
   y presiona **Start**.
3. PWABuilder analiza tu app (ya tiene el manifest e íconos listos). Click
   en **Package for stores**.
4. Elige **Android**.
5. En las opciones, te recomiendo:
   - Deja los valores por defecto (Package ID, nombre, versión).
   - Activa **"Signing key" → "Create new"** para que PWABuilder genere
     una firma nueva automáticamente (más simple que subir la tuya propia).
6. Click en **Generate** y descarga el `.zip` que te entrega. Adentro vas a
   encontrar un archivo `.apk` — ese es el que compartes con tu equipo por
   WhatsApp, correo, etc. para instalar la app en sus celulares Android.

   > Al instalar, Android va a mostrar una advertencia de "fuente
   > desconocida" porque no viene de Google Play — es normal, deben
   > permitir la instalación igual.

7. **Guarda el `.zip` completo en un lugar seguro** (no solo el `.apk`).
   Contiene la llave de firma (`signing.keystore`) que vas a necesitar si
   algún día quieres volver a generar el APK con la misma identidad (por
   ejemplo, para subirlo a Google Play más adelante).

---

## Cómo actualizar la app en el futuro

Esta es la parte importante que resuelve el problema de "cómo actualizo
después":

- **Cambios en las calculadoras, precios, catálogo, cualquier funcionalidad:**
  solo subes el código nuevo a GitHub (`git push`) y Render lo despliega
  automáticamente en 2-3 minutos. **Todos los usuarios ven el cambio al
  instante la próxima vez que abran la app — nadie necesita reinstalar
  nada, ni tú generar un APK nuevo.**

- **Cuándo SÍ necesitas generar un APK nuevo:** solo si cambias el ícono de
  la app, el nombre que aparece bajo el ícono, o algo del `manifest.json`.
  Eso pasa muy rara vez. En ese caso repites el Paso 5.

---

## Resumen de lo que se creó en el proyecto

- `server.ts` — backend con login, roles (admin/operador) y conexión a la
  base de datos. Las tablas se crean solas al arrancar.
- `src/context/AuthContext.tsx` y `src/components/auth/LoginScreen.tsx` —
  pantalla e infraestructura de login.
- `src/components/admin/UserManagementModal.tsx` — panel para crear y
  administrar usuarios (solo visible para administradores).
- `public/manifest.json`, `public/icon-*.png`, `public/sw.js` — necesarios
  para que PWABuilder pueda generar el APK.
- `.env.example` — lista de todas las variables de entorno que necesitas
  configurar en Render.
- `schema.sql` — referencia de la estructura de la base de datos (se aplica
  sola, no hace falta ejecutarla a mano).
