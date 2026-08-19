# Aceros Chile — Gestión de Materiales y Calculadoras Técnicas

App de gestión de materiales para maestranzas: manual interactivo de
perfiles de acero, calculadoras de peso (planchas, perfiles, piezas a
medida, plegado de canales), catálogo de precios, cubicación de proyectos
e historial. Incluye acceso por usuario y contraseña asignados por un
administrador, con roles de **Administrador** y **Operador**.

## 📖 Para publicar la app (web + APK de Android)

Sigue la guía completa paso a paso en **[DEPLOY.md](./DEPLOY.md)**. Cubre:

1. Crear la base de datos (Supabase, gratis)
2. Publicar la app en la web (Render, gratis)
3. Crear los usuarios de tu equipo
4. Generar el archivo `.apk` para instalar en Android (PWABuilder, sin
   instalar nada en tu computador)
5. Cómo actualizar la app en el futuro

## Desarrollo local

**Requisitos:** Node.js 20+ y una base de datos Postgres (puedes usar una
gratuita de Supabase incluso para desarrollo).

```bash
npm install
cp .env.example .env   # y completa DATABASE_URL, JWT_SECRET, etc.
npm run dev
```

Abre `http://localhost:3000`. La primera vez que arranca, se crea
automáticamente el usuario administrador definido en `ADMIN_USERNAME` /
`ADMIN_PASSWORD` de tu `.env`.

## Estructura

- `server.ts` — backend (Express + Postgres): autenticación, usuarios,
  proyectos, historial.
- `src/` — frontend (React + Vite + Tailwind).
- `public/` — manifest PWA, íconos y service worker (necesarios para
  generar el APK de Android).
