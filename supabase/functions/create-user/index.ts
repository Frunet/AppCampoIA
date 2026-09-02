// Edge Function: create-user
//
// Administracion de cuentas de acceso. A pesar del nombre (se quedo el
// original para no romper la URL /functions/v1/create-user ya usada en el
// cliente), ahora cubre tres acciones sobre `action` en el body:
//   - "create" (por defecto si no se manda `action`, para no romper el
//     payload que ya mandaba el cliente antes de esta ampliacion)
//   - "delete"
//   - "reset-password"
// Las tres exigen que el caller este autenticado y sea admin.
//
// Entrada (JSON):
//   create:         { action?: "create", email, full_name, role, farm_ids? }
//   delete:         { action: "delete", user_id }
//   reset-password: { action: "reset-password", user_id, new_password }
//
// Salida (200):
//   create:         { user_id, email, temp_password }
//   delete/reset:   { ok: true }
//
// La fila en profiles y la entrada en user_roles las crea automaticamente
// el trigger public.handle_new_user() (ver migracion inicial), que lee
// full_name/role de user_metadata al crear el usuario en Auth — por eso
// "create" no inserta en profiles/user_roles a mano, solo en
// farm_managers (que no tiene trigger).
//
// Decision (create): sin invitacion por email — este proyecto no tiene un
// pipeline de email configurado/verificado, asi que se sigue el mismo
// mecanismo que ya usaban las cuentas existentes: contraseña temporal
// generada aqui, devuelta en la respuesta para que el admin se la entregue.
// email_confirm=true evita el paso de verificacion.
//
// Decision (delete): auth.admin.deleteUser() basta por si solo. profiles
// referencia a auth.users con ON DELETE CASCADE, y user_roles/
// farm_managers/work_hours.created_by/work_hours.updated_by/
// purchases.created_by/tasks.created_by tienen CASCADE o SET NULL segun
// corresponda (ver migraciones) — no hace falta borrar nada a mano, y
// duplicarlo aqui solo añadiria una condicion de carrera si algo fallara a
// mitad. Se impide que un admin se borre a si mismo (no estaba pedido,
// pero borrar tu propia cuenta mientras la usas es un error facil de
// cometer y dificil de deshacer si eras el unico admin).
//
// Decision (reset-password): auth.admin.updateUserById() con el password
// nuevo directo, sin flujo de email — es lo que pide el punto 2 del
// encargo (contraseña fijada por el admin, no un enlace de recuperacion).

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function randomTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
  return `Ac-${b64.slice(0, 14)}!1`;
}

type Payload = {
  action?: "create" | "delete" | "reset-password";
  // create
  email?: string;
  full_name?: string;
  role?: "admin" | "manager";
  farm_ids?: string[];
  // delete / reset-password
  user_id?: string;
  // reset-password
  new_password?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PUBLISHABLE_KEY) {
    console.error("create-user: faltan variables de entorno de Supabase");
    return json({ error: "Función mal configurada (faltan variables de entorno)." }, 500);
  }

  // 1) El caller debe ser un admin autenticado — comun a las tres acciones.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "No autenticado." }, 401);

  const callerClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData.user) return json({ error: "Sesión inválida." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: callerData.user.id,
    _role: "admin",
  });
  if (roleErr) {
    console.error("create-user: error comprobando rol", roleErr);
    return json({ error: "No se pudo comprobar el rol del solicitante." }, 500);
  }
  if (!isAdmin) return json({ error: "Solo un administrador puede gestionar usuarios." }, 403);

  // 2) Leer body.
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Cuerpo de la petición inválido (se esperaba JSON)." }, 400);
  }

  const action = payload.action ?? "create";

  // -------------------------------------------------------------------
  // Eliminar usuario
  // -------------------------------------------------------------------
  if (action === "delete") {
    const userId = payload.user_id;
    if (!userId) return json({ error: "Falta user_id." }, 400);
    if (userId === callerData.user.id) {
      return json({ error: "No puedes eliminar tu propia cuenta." }, 400);
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("create-user: error eliminando usuario", error);
      return json({ error: error.message }, 400);
    }
    return json({ ok: true });
  }

  // -------------------------------------------------------------------
  // Restablecer contraseña
  // -------------------------------------------------------------------
  if (action === "reset-password") {
    const userId = payload.user_id;
    const newPassword = payload.new_password;
    if (!userId) return json({ error: "Falta user_id." }, 400);
    if (!newPassword || newPassword.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      console.error("create-user: error restableciendo contraseña", error);
      return json({ error: error.message }, 400);
    }
    return json({ ok: true });
  }

  // -------------------------------------------------------------------
  // Crear usuario (comportamiento original)
  // -------------------------------------------------------------------
  const email = payload.email?.trim().toLowerCase();
  const full_name = payload.full_name?.trim();
  const role = payload.role;
  const farm_ids = Array.isArray(payload.farm_ids) ? payload.farm_ids.filter(Boolean) : [];

  if (!email || !email.includes("@")) return json({ error: "Email inválido." }, 400);
  if (!full_name) return json({ error: "Falta el nombre completo." }, 400);
  if (role !== "admin" && role !== "manager") {
    return json({ error: 'El rol debe ser "admin" o "manager".' }, 400);
  }
  if (role === "manager" && farm_ids.length === 0) {
    return json({ error: "Un encargado (manager) necesita al menos una finca asignada." }, 400);
  }

  const temp_password = randomTempPassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (createErr) {
    const yaExiste = /already|exists|registered/i.test(createErr.message);
    return json(
      { error: yaExiste ? "Ya existe un usuario con ese email." : createErr.message },
      yaExiste ? 409 : 400,
    );
  }

  const userId = created.user.id;

  if (farm_ids.length > 0) {
    const rows = farm_ids.map((farm_id) => ({ user_id: userId, farm_id }));
    const { error: fmErr } = await admin.from("farm_managers").insert(rows);
    if (fmErr) {
      console.error("create-user: usuario creado pero fallo la asignación de fincas", fmErr);
      return json(
        {
          error: `Usuario creado, pero no se pudieron asignar las fincas: ${fmErr.message}`,
          user_id: userId,
          email,
          temp_password,
        },
        207,
      );
    }
  }

  return json({ user_id: userId, email, temp_password });
});
