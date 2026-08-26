# Respaldo automático de la base de datos

Este repositorio incluye un respaldo diario automático vía GitHub Actions
(`.github/workflows/db-backup.yml`), independiente del plan de Supabase que
tengas contratado.

## Por qué esto importa

El plan gratuito de Supabase **no incluye respaldos automáticos**. Si tu
proyecto está en el plan gratuito y la base de datos se corrompe, se borra
por error, o falla una migración, no hay forma de recuperarla desde
Supabase. El plan Pro (US$25/mes) sí agrega respaldos diarios con 7 días de
retención — vale la pena evaluarlo ahora que la app maneja inventario real
de la maestranza, pero este workflow funciona igual lo tengas o no, como una
copia adicional fuera de Supabase.

## Configuración (una sola vez)

1. En GitHub, entra a tu repositorio → **Settings → Secrets and variables →
   Actions → New repository secret**.
2. Nombre del secret: `DATABASE_URL`
3. Valor: la misma cadena de conexión Postgres que usa `server.ts` (la que
   tienes configurada como variable de entorno donde despliegas la app).
4. Guarda. Listo — el respaldo corre solo, todos los días a las 6:00 UTC.

Puedes probarlo de inmediato sin esperar al horario programado: pestaña
**Actions** → "Respaldo diario de base de datos" → **Run workflow**.

## Dónde quedan los respaldos

En la pestaña **Actions** de GitHub, dentro de cada ejecución del workflow,
en la sección **Artifacts**. Se guardan 30 días y después se borran solos
(configurable en el archivo del workflow, `retention-days`).

## Cómo restaurar un respaldo

1. Descarga el archivo `.dump` desde la pestaña Actions → esa ejecución →
   Artifacts.
2. Con el cliente de PostgreSQL instalado en tu computador:

```bash
pg_restore --no-owner --no-privileges -d "TU_DATABASE_URL_DESTINO" respaldo_acero_2026-01-01_0600.dump
```

3. **Recomendado**: restaura primero contra una base de datos de prueba
   (no la de producción) para confirmar que el respaldo sirve antes de
   necesitarlo de verdad.

## Nota sobre datos sensibles

El respaldo incluye TODO lo que hay en la base de datos (usuarios, hashes de
contraseña, inventario, proyectos). Los artefactos de GitHub Actions solo
son visibles para quienes tengan acceso al repositorio — si el repo es
público, considera pasarlo a privado antes de activar este workflow.
