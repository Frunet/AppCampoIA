import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

/**
 * Resuelve nombre de usuario (full_name, o email si no hay nombre) a partir
 * de sus ids, para las columnas "Creado por"/"Modificado por" del Excel de
 * Informes. profiles solo es legible por el propio dueño o un admin (RLS en
 * la migracion inicial) — cualquier encargado tiene que poder exportar y
 * ver quien registro/edito horas de OTROS usuarios, asi que esto usa la
 * service role (supabaseAdmin) para saltarse esa restriccion, igual que
 * hace client.server.ts para operaciones de confianza en el servidor. Solo
 * devuelve full_name/email de los ids pedidos, nada mas sensible.
 */
export const resolveUserNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const ids = [...new Set(data.userIds)];
    if (ids.length === 0) return { names: {} as Record<string, string> };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", ids);
    if (error) throw error;

    const names: Record<string, string> = {};
    for (const p of profiles ?? []) {
      names[p.id] = p.full_name || p.email || p.id;
    }
    return { names };
  });
