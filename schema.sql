-- Este esquema se crea AUTOMÁTICAMENTE la primera vez que el servidor arranca
-- (ver la función initDatabase() en server.ts). No necesitas ejecutar este
-- archivo a mano — se incluye solo como referencia de la estructura de datos.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null default '',
  role text not null check (role in ('admin', 'operador')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  name text not null,
  updated_at bigint not null,
  created_by uuid references users(id) on delete set null,
  data jsonb not null
);

create table if not exists history_items (
  id text primary key,
  timestamp bigint not null,
  created_by uuid references users(id) on delete set null,
  data jsonb not null
);

-- Módulo "Cubicación y Bodega" (importado desde la app Inventario-y-Cubicación).
-- Mismo patrón que 'projects': fila = 1 proyecto BOM completo (grupos, nesting,
-- compras) guardado como jsonb. Es información compartida por toda la
-- maestranza (no filtrada por usuario), igual que projects/history.
create table if not exists bom_projects (
  id text primary key,
  name text not null,
  updated_at bigint not null,
  created_by uuid references users(id) on delete set null,
  data jsonb not null
);

-- Inventario de bodega (barras + retazos). Una fila por material (perfil).
-- Es el "stock" compartido de toda la maestranza, se actualiza con cada
-- descuento de pre-anidado o ingreso de compra.
create table if not exists inventory_items (
  id text primary key,
  code text not null,
  updated_at bigint not null,
  created_by uuid references users(id) on delete set null,
  data jsonb not null
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);
