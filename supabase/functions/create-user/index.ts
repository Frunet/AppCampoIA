// Edge Function: create-user
//
// Da de alta una cuenta de acceso (Supabase Auth + rol + fincas asignadas).
// Solo puede invocarla un usuario ya autenticado con rol admin.
//
// Entrada (JSON):
//   { email: string, full_name: string, role: "admin" | "manager", farm_ids?: string[] }
//
// Salida (200):
//   { user_id: string, email: string, temp_password: string }
//
// La fila en profiles y la entrada en user_roles las crea automaticamente
// el trigger public.handle_new_user() (ver migracion inicial), que lee
// full_name/role de user_metadata al crear el usuario en Auth — por eso
// esta funcion no inserta en profiles/user_roles a mano, solo en
// farm_managers (que no tiene trigger).
//
// Decision: no hay pipeline de email configurado/verificado en este
// proyecto (los usuarios existentes se crearon con contraseña temporal via
// script, no por invitacion), asi que se sigue ese mismo mecanismo:
// contraseña temporal generada aqui, devuelta en la respuesta para que el
// admin se la entregue. email_confirm=true evita el paso de verificacion.

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
  email?: string;
  full_name?: string;
  role?: "admin" | "manager";
  farm_ids?: string[];
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

  // 1) El caller debe ser un admin autenticado.
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
  if (!isAdmin) return json({ error: "Solo un administrador puede crear usuarios." }, 403);

  // 2) Validar entrada.
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Cuerpo de la petición inválido (se esperaba JSON)." }, 400);
  }

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

  // 3) Crear el usuario en Auth. El trigger handle_new_user() crea la fila
  // en profiles y en user_roles a partir de user_metadata.
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

  // 4) Asignar fincas (solo tiene sentido para manager; si un admin manda
  // fincas igualmente se guardan, no le hacen falta para el acceso pero no
  // estorban).
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
