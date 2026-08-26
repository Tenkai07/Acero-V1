import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    "[AVISO] No se definió JWT_SECRET en las variables de entorno. Usando un valor temporal inseguro solo para desarrollo local."
  );
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev-secret-inseguro-cambiar-en-produccion";
const TOKEN_EXPIRY = "30d";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "[ERROR] No se definió DATABASE_URL. Configura la cadena de conexión de tu base de datos Postgres (Supabase) en las variables de entorno."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

app.use(express.json({ limit: "20mb" }));

// ---------------------------------------------------------------------------
// Database bootstrap: create tables if they don't exist yet, and seed the
// first admin user from environment variables so there's always a way in.
// ---------------------------------------------------------------------------
async function initDatabase() {
  await pool.query(`create extension if not exists pgcrypto;`);

  await pool.query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      username text unique not null,
      password_hash text not null,
      full_name text not null default '',
      role text not null check (role in ('admin', 'operador')),
      active boolean not null default true,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists projects (
      id text primary key,
      name text not null,
      updated_at bigint not null,
      created_by uuid references users(id) on delete set null,
      data jsonb not null
    );
  `);

  await pool.query(`
    create table if not exists history_items (
      id text primary key,
      timestamp bigint not null,
      created_by uuid references users(id) on delete set null,
      data jsonb not null
    );
  `);

  await pool.query(`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null
    );
  `);

  // Módulo "Cubicación y Bodega": proyectos BOM (nesting/compras) e
  // inventario de bodega (barras + retazos), compartidos por toda la
  // maestranza igual que projects/history.
  await pool.query(`
    create table if not exists bom_projects (
      id text primary key,
      name text not null,
      updated_at bigint not null,
      created_by uuid references users(id) on delete set null,
      data jsonb not null
    );
  `);

  await pool.query(`
    create table if not exists inventory_items (
      id text primary key,
      code text not null,
      updated_at bigint not null,
      created_by uuid references users(id) on delete set null,
      data jsonb not null
    );
  `);

  const { rows } = await pool.query(`select count(*)::int as count from users`);
  if (rows[0].count === 0) {
    const bootstrapUsername = process.env.ADMIN_USERNAME || "admin";
    const bootstrapPassword = process.env.ADMIN_PASSWORD || "cambiar123";
    const bootstrapName = process.env.ADMIN_FULL_NAME || "Administrador";
    const hash = await bcrypt.hash(bootstrapPassword, 10);
    await pool.query(
      `insert into users (username, password_hash, full_name, role, active) values ($1, $2, $3, 'admin', true)`,
      [bootstrapUsername, hash, bootstrapName]
    );
    console.log(
      `[SETUP] Se creó el usuario administrador inicial "${bootstrapUsername}". ` +
        (process.env.ADMIN_PASSWORD
          ? "Se usó la contraseña definida en ADMIN_PASSWORD."
          : `AVISO: usando contraseña por defecto "${bootstrapPassword}". Cámbiala apenas inicies sesión.`)
    );
  }

  const settingsCheck = await pool.query(`select 1 from app_settings where key = 'base_price_kg_clp'`);
  if (settingsCheck.rowCount === 0) {
    await pool.query(`insert into app_settings (key, value) values ('base_price_kg_clp', '1420'::jsonb)`);
  }
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
interface AuthedRequest extends express.Request {
  user?: { id: string; username: string; role: "admin" | "operador"; fullName: string };
}

function signToken(user: { id: string; username: string; role: string; fullName: string }) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No autenticado" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as any;
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role, fullName: decoded.fullName };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: "Sesión inválida o expirada" });
  }
}

function requireAdmin(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Solo un administrador puede hacer esto" });
  }
  next();
}

// ---------------------------------------------------------------------------
// Health check (no auth — used by the hosting platform)
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Aceros Chile",
    version: "3.0.0",
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Falta usuario o contraseña" });
  }
  try {
    const { rows } = await pool.query(
      `select id, username, password_hash, full_name, role, active from users where username = $1`,
      [String(username).trim()]
    );
    const user = rows[0];
    if (!user || !user.active) {
      return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
    }
    const publicUser = { id: user.id, username: user.username, fullName: user.full_name, role: user.role };
    const token = signToken(publicUser);
    res.json({ success: true, token, user: publicUser });
  } catch (e) {
    console.error("Error en login", e);
    res.status(500).json({ success: false, error: "Error del servidor al iniciar sesión" });
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ success: true, user: req.user });
});

app.post("/api/auth/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ success: false, error: "La nueva contraseña debe tener al menos 4 caracteres" });
  }
  try {
    const { rows } = await pool.query(`select password_hash from users where id = $1`, [req.user!.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    const valid = await bcrypt.compare(currentPassword || "", rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, error: "Contraseña actual incorrecta" });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`update users set password_hash = $1 where id = $2`, [hash, req.user!.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("Error cambiando contraseña", e);
    res.status(500).json({ success: false, error: "Error del servidor" });
  }
});

// ---------------------------------------------------------------------------
// User management (admin only)
// ---------------------------------------------------------------------------
app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `select id, username, full_name, role, active, created_at from users order by created_at asc`
  );
  res.json({
    success: true,
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      active: u.active,
      createdAt: u.created_at
    }))
  });
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const { username, password, fullName, role } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ success: false, error: "Faltan datos: usuario, contraseña y rol son obligatorios" });
  }
  if (!["admin", "operador"].includes(role)) {
    return res.status(400).json({ success: false, error: "Rol inválido" });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 4 caracteres" });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into users (username, password_hash, full_name, role, active)
       values ($1, $2, $3, $4, true)
       returning id, username, full_name, role, active, created_at`,
      [String(username).trim(), hash, fullName || "", role]
    );
    const u = rows[0];
    res.json({
      success: true,
      user: { id: u.id, username: u.username, fullName: u.full_name, role: u.role, active: u.active, createdAt: u.created_at }
    });
  } catch (e: any) {
    if (e.code === "23505") {
      return res.status(409).json({ success: false, error: "Ese nombre de usuario ya existe" });
    }
    console.error("Error creando usuario", e);
    res.status(500).json({ success: false, error: "Error del servidor al crear usuario" });
  }
});

app.patch("/api/users/:id", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { fullName, role, active, newPassword } = req.body || {};

  if (id === req.user!.id && (active === false || role === "operador")) {
    return res.status(400).json({ success: false, error: "No puedes quitarte a ti mismo el acceso de administrador" });
  }

  try {
    if (newPassword) {
      if (String(newPassword).length < 4) {
        return res.status(400).json({ success: false, error: "La nueva contraseña debe tener al menos 4 caracteres" });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(`update users set password_hash = $1 where id = $2`, [hash, id]);
    }
    if (fullName !== undefined) {
      await pool.query(`update users set full_name = $1 where id = $2`, [fullName, id]);
    }
    if (role !== undefined) {
      if (!["admin", "operador"].includes(role)) {
        return res.status(400).json({ success: false, error: "Rol inválido" });
      }
      await pool.query(`update users set role = $1 where id = $2`, [role, id]);
    }
    if (active !== undefined) {
      await pool.query(`update users set active = $1 where id = $2`, [active, id]);
    }
    const { rows } = await pool.query(
      `select id, username, full_name, role, active, created_at from users where id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    const u = rows[0];
    res.json({
      success: true,
      user: { id: u.id, username: u.username, fullName: u.full_name, role: u.role, active: u.active, createdAt: u.created_at }
    });
  } catch (e) {
    console.error("Error actualizando usuario", e);
    res.status(500).json({ success: false, error: "Error del servidor al actualizar usuario" });
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  if (id === req.user!.id) {
    return res.status(400).json({ success: false, error: "No puedes eliminar tu propia cuenta" });
  }
  try {
    await pool.query(`delete from users where id = $1`, [id]);
    res.json({ success: true });
  } catch (e) {
    // Foreign key references (proyectos/historial creados por este usuario) impiden el borrado.
    console.warn("No se pudo eliminar usuario, se desactiva en su lugar", e);
    await pool.query(`update users set active = false where id = $1`, [id]);
    res.json({ success: true, note: "El usuario tenía datos asociados, se desactivó en lugar de eliminarse." });
  }
});

// ---------------------------------------------------------------------------
// App settings (precio base) — cualquier usuario autenticado puede leer,
// solo un admin puede escribir.
// ---------------------------------------------------------------------------
app.get("/api/settings/base-price", requireAuth, async (req, res) => {
  const { rows } = await pool.query(`select value from app_settings where key = 'base_price_kg_clp'`);
  res.json({ success: true, basePriceKgCLP: rows[0] ? rows[0].value : 1420 });
});

app.put("/api/settings/base-price", requireAuth, requireAdmin, async (req, res) => {
  const { basePriceKgCLP } = req.body || {};
  const price = Number(basePriceKgCLP);
  if (!price || price <= 0) {
    return res.status(400).json({ success: false, error: "Precio inválido" });
  }
  await pool.query(
    `insert into app_settings (key, value) values ('base_price_kg_clp', $1::jsonb)
     on conflict (key) do update set value = $1::jsonb`,
    [JSON.stringify(price)]
  );
  res.json({ success: true, basePriceKgCLP: price });
});

// Catálogo de productos Softland (importado desde el "Informe de Productos
// Paramétrico"). Se guarda una sola vez como un JSON compartido para que
// cualquiera en la maestranza pueda buscar códigos sin tener que volver a
// subir el Excel cada vez.
app.get("/api/settings/softland-catalog", requireAuth, async (req, res) => {
  const { rows } = await pool.query(`select value from app_settings where key = 'softland_catalog'`);
  res.json({ success: true, catalog: rows[0] ? rows[0].value : [] });
});

app.put("/api/settings/softland-catalog", requireAuth, async (req, res) => {
  const { catalog } = req.body || {};
  if (!Array.isArray(catalog)) {
    return res.status(400).json({ success: false, error: "El catálogo debe ser un arreglo" });
  }
  if (catalog.length > 50000) {
    return res.status(400).json({ success: false, error: "El catálogo excede el máximo soportado (50.000 productos)" });
  }
  const invalid = catalog.some((p) => !p || typeof p.code !== "string" || typeof p.description !== "string");
  if (invalid) {
    return res.status(400).json({ success: false, error: "Cada producto del catálogo necesita 'code' y 'description' como texto" });
  }
  await pool.query(
    `insert into app_settings (key, value) values ('softland_catalog', $1::jsonb)
     on conflict (key) do update set value = $1::jsonb`,
    [JSON.stringify(catalog)]
  );
  res.json({ success: true, count: catalog.length });
});

// ---------------------------------------------------------------------------
// Projects API
// ---------------------------------------------------------------------------
app.get("/api/projects", requireAuth, async (req, res) => {
  const { rows } = await pool.query(`select data from projects order by updated_at desc`);
  res.json({ success: true, projects: rows.map((r) => r.data) });
});

app.post("/api/projects", requireAuth, async (req: AuthedRequest, res) => {
  const { projects, ...maybeSingle } = req.body || {};

  try {
    if (Array.isArray(projects)) {
      for (const p of projects) {
        await upsertProject(p, req.user!.id);
      }
      const { rows } = await pool.query(`select data from projects order by updated_at desc`);
      return res.json({ success: true, count: rows.length, projects: rows.map((r) => r.data) });
    }

    const singleProject = maybeSingle;
    if (singleProject && singleProject.id) {
      const saved = await upsertProject(singleProject, req.user!.id);
      return res.json({ success: true, project: saved });
    }

    res.status(400).json({ success: false, error: "Formato de proyecto inválido" });
  } catch (e) {
    console.error("Error guardando proyecto", e);
    res.status(500).json({ success: false, error: "Error del servidor al guardar el proyecto" });
  }
});

async function upsertProject(project: any, userId: string) {
  const now = Date.now();
  const updatedAt =
    typeof project.updatedAt === "number"
      ? project.updatedAt
      : project.updatedAt
      ? new Date(project.updatedAt).getTime()
      : now;
  const dataToStore = { ...project, updatedAt: project.updatedAt || now };
  await pool.query(
    `insert into projects (id, name, updated_at, created_by, data)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (id) do update set name = $2, updated_at = $3, data = $5::jsonb`,
    [project.id, project.name || "Proyecto sin nombre", updatedAt, userId, JSON.stringify(dataToStore)]
  );
  return dataToStore;
}

app.delete("/api/projects/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  await pool.query(`delete from projects where id = $1`, [id]);
  res.json({ success: true, deletedId: id });
});

// ---------------------------------------------------------------------------
// History API
// ---------------------------------------------------------------------------
app.get("/api/history", requireAuth, async (req, res) => {
  const { rows } = await pool.query(`select data from history_items order by timestamp desc limit 500`);
  res.json({ success: true, history: rows.map((r) => r.data) });
});

app.post("/api/history", requireAuth, async (req: AuthedRequest, res) => {
  const { history, item } = req.body || {};
  try {
    if (Array.isArray(history)) {
      for (const h of history) {
        await upsertHistoryItem(h, req.user!.id);
      }
      const { rows } = await pool.query(`select data from history_items order by timestamp desc limit 500`);
      return res.json({ success: true, count: rows.length, history: rows.map((r) => r.data) });
    }
    if (item && item.id) {
      const saved = await upsertHistoryItem(item, req.user!.id);
      await pool.query(`
        delete from history_items where id in (
          select id from history_items order by timestamp desc offset 500
        )
      `);
      return res.json({ success: true, item: saved });
    }
    res.status(400).json({ success: false, error: "Formato de historial inválido" });
  } catch (e) {
    console.error("Error guardando historial", e);
    res.status(500).json({ success: false, error: "Error del servidor al guardar el historial" });
  }
});

async function upsertHistoryItem(item: any, userId: string) {
  const timestamp = typeof item.timestamp === "number" ? item.timestamp : Date.now();
  const dataToStore = { ...item, timestamp };
  await pool.query(
    `insert into history_items (id, timestamp, created_by, data)
     values ($1, $2, $3, $4::jsonb)
     on conflict (id) do update set timestamp = $2, data = $4::jsonb`,
    [item.id, timestamp, userId, JSON.stringify(dataToStore)]
  );
  return dataToStore;
}

app.delete("/api/history/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  await pool.query(`delete from history_items where id = $1`, [id]);
  res.json({ success: true, deletedId: id });
});

app.delete("/api/history", requireAuth, async (req, res) => {
  await pool.query(`delete from history_items`);
  res.json({ success: true, message: "Historial limpiado" });
});

// ---------------------------------------------------------------------------
// Módulo Cubicación y Bodega — Proyectos BOM (nesting/compras)
// ---------------------------------------------------------------------------
app.get("/api/bom-projects", requireAuth, async (req, res) => {
  const { rows } = await pool.query(`select data from bom_projects order by updated_at desc`);
  res.json({ success: true, bomProjects: rows.map((r) => r.data) });
});

app.post("/api/bom-projects", requireAuth, async (req: AuthedRequest, res) => {
  const { bomProjects, ...maybeSingle } = req.body || {};
  try {
    if (Array.isArray(bomProjects)) {
      const skipped: string[] = [];
      let saved = 0;
      for (const p of bomProjects) {
        if (!p || typeof p.id !== "string" || p.id.trim().length === 0) {
          skipped.push(String(p?.id ?? "(sin id)"));
          continue;
        }
        await upsertBomProject(p, req.user!.id);
        saved++;
      }
      const { rows } = await pool.query(`select data from bom_projects order by updated_at desc`);
      return res.json({ success: true, count: saved, skipped, bomProjects: rows.map((r) => r.data) });
    }
    const single = maybeSingle;
    if (single && typeof single.id === "string" && single.id.trim().length > 0) {
      const saved = await upsertBomProject(single, req.user!.id);
      return res.json({ success: true, bomProject: saved });
    }
    res.status(400).json({ success: false, error: "Formato de proyecto de cubicación inválido: falta un 'id' de texto válido" });
  } catch (e) {
    console.error("Error guardando proyecto de cubicación", e);
    res.status(500).json({ success: false, error: "Error del servidor al guardar el proyecto de cubicación" });
  }
});

async function upsertBomProject(project: any, userId: string) {
  const now = Date.now();
  const updatedAt =
    typeof project.updatedAt === "number"
      ? project.updatedAt
      : project.updatedAt
      ? new Date(project.updatedAt).getTime()
      : now;
  const dataToStore = { ...project, updatedAt: project.updatedAt || now };
  await pool.query(
    `insert into bom_projects (id, name, updated_at, created_by, data)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (id) do update set name = $2, updated_at = $3, data = $5::jsonb`,
    [project.id, project.name || "Proyecto de cubicación sin nombre", updatedAt, userId, JSON.stringify(dataToStore)]
  );
  return dataToStore;
}

app.delete("/api/bom-projects/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  await pool.query(`delete from bom_projects where id = $1`, [id]);
  res.json({ success: true, deletedId: id });
});

// ---------------------------------------------------------------------------
// Módulo Cubicación y Bodega — Inventario de bodega (barras + retazos)
// ---------------------------------------------------------------------------
app.get("/api/inventory", requireAuth, async (req, res) => {
  const { rows } = await pool.query(`select data from inventory_items order by updated_at desc`);
  res.json({ success: true, inventory: rows.map((r) => r.data) });
});

app.post("/api/inventory", requireAuth, async (req: AuthedRequest, res) => {
  const { inventory, ...maybeSingle } = req.body || {};
  try {
    if (Array.isArray(inventory)) {
      // Reemplazo completo: el cliente de Inventario maneja la lista entera
      // en memoria (agrega/edita/descuenta) y guarda el arreglo completo.
      // Se sincroniza como "upsert de todos + borrar los que ya no están".
      const valid = inventory.filter((it: any) => it && typeof it.id === "string" && it.id.trim().length > 0);
      const skipped = inventory.length - valid.length;
      for (const it of valid) {
        await upsertInventoryItem(it, req.user!.id);
      }
      const incomingIds = valid.map((it: any) => it.id);
      if (incomingIds.length > 0) {
        await pool.query(`delete from inventory_items where not (id = any($1::text[]))`, [incomingIds]);
      }
      const { rows } = await pool.query(`select data from inventory_items order by updated_at desc`);
      return res.json({ success: true, count: rows.length, skipped, inventory: rows.map((r) => r.data) });
    }
    const single = maybeSingle;
    if (single && typeof single.id === "string" && single.id.trim().length > 0) {
      const saved = await upsertInventoryItem(single, req.user!.id);
      return res.json({ success: true, item: saved });
    }
    res.status(400).json({ success: false, error: "Formato de inventario inválido: falta un 'id' de texto válido" });
  } catch (e) {
    console.error("Error guardando inventario", e);
    res.status(500).json({ success: false, error: "Error del servidor al guardar el inventario" });
  }
});

async function upsertInventoryItem(item: any, userId: string) {
  const now = Date.now();
  const dataToStore = { ...item, lastUpdated: item.lastUpdated || new Date().toISOString() };
  const updatedAt = new Date(dataToStore.lastUpdated).getTime() || now;
  await pool.query(
    `insert into inventory_items (id, code, updated_at, created_by, data)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (id) do update set code = $2, updated_at = $3, data = $5::jsonb`,
    [item.id, item.code || item.id, updatedAt, userId, JSON.stringify(dataToStore)]
  );
  return dataToStore;
}

app.delete("/api/inventory/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  await pool.query(`delete from inventory_items where id = $1`, [id]);
  res.json({ success: true, deletedId: id });
});

// ---------------------------------------------------------------------------
// Cloud sync endpoint (bidirectional merge) — usado por el cliente cuando
// vuelve a tener conexión, para fusionar lo que guardó localmente.
// ---------------------------------------------------------------------------
app.post("/api/sync", requireAuth, async (req: AuthedRequest, res) => {
  const { localProjects, localHistory, localBomProjects, localInventory } = req.body || {};

  try {
    if (Array.isArray(localProjects)) {
      const { rows: serverRows } = await pool.query(`select id, updated_at from projects`);
      const serverUpdatedAt = new Map(serverRows.map((r) => [r.id, Number(r.updated_at)]));
      for (const lp of localProjects) {
        const serverTs = serverUpdatedAt.get(lp.id);
        const localTs = typeof lp.updatedAt === "number" ? lp.updatedAt : new Date(lp.updatedAt || 0).getTime();
        if (serverTs === undefined || localTs >= serverTs) {
          await upsertProject(lp, req.user!.id);
        }
      }
    }
    if (Array.isArray(localHistory)) {
      const { rows: existing } = await pool.query(`select id from history_items`);
      const existingIds = new Set(existing.map((r) => r.id));
      for (const lh of localHistory) {
        if (!existingIds.has(lh.id)) {
          await upsertHistoryItem(lh, req.user!.id);
        }
      }
    }
    if (Array.isArray(localBomProjects)) {
      const { rows: serverRows } = await pool.query(`select id, updated_at from bom_projects`);
      const serverUpdatedAt = new Map(serverRows.map((r) => [r.id, Number(r.updated_at)]));
      for (const lp of localBomProjects) {
        const serverTs = serverUpdatedAt.get(lp.id);
        const localTs = typeof lp.updatedAt === "number" ? lp.updatedAt : new Date(lp.updatedAt || Date.now()).getTime();
        if (serverTs === undefined || localTs >= serverTs) {
          await upsertBomProject(lp, req.user!.id);
        }
      }
    }
    if (Array.isArray(localInventory)) {
      const { rows: serverRows } = await pool.query(`select id, updated_at from inventory_items`);
      const serverUpdatedAt = new Map(serverRows.map((r) => [r.id, Number(r.updated_at)]));
      for (const it of localInventory) {
        const serverTs = serverUpdatedAt.get(it.id);
        const localTs = new Date(it.lastUpdated || 0).getTime();
        // Si el material no existe aún en el servidor, o la copia local es
        // igual o más nueva, se sube. Si el servidor tiene una versión más
        // nueva (otro terminal descontó stock después), se respeta esa.
        if (serverTs === undefined || localTs >= serverTs) {
          await upsertInventoryItem(it, req.user!.id);
        }
      }
    }

    const { rows: projectRows } = await pool.query(`select data from projects order by updated_at desc`);
    const { rows: historyRows } = await pool.query(`select data from history_items order by timestamp desc limit 500`);
    const { rows: bomProjectRows } = await pool.query(`select data from bom_projects order by updated_at desc`);
    const { rows: inventoryRows } = await pool.query(`select data from inventory_items order by updated_at desc`);

    res.json({
      success: true,
      projects: projectRows.map((r) => r.data),
      history: historyRows.map((r) => r.data),
      bomProjects: bomProjectRows.map((r) => r.data),
      inventory: inventoryRows.map((r) => r.data),
      serverTimestamp: Date.now()
    });
  } catch (e) {
    console.error("Error sincronizando", e);
    res.status(500).json({ success: false, error: "Error del servidor al sincronizar" });
  }
});

// ---------------------------------------------------------------------------
// Frontend (Vite dev middleware in dev, static build in production)
// ---------------------------------------------------------------------------
async function startServer() {
  await initDatabase().catch((e) => {
    console.error("No se pudo inicializar la base de datos. Revisa DATABASE_URL.", e);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aceros Chile backend corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
