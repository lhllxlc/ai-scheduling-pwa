import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { context, DEMO_COOKIE } from "@/lib/server/auth";
import { ApiError, deleteDemoSession } from "@/lib/server/demo";
import { body, checkOrigin, ok, route } from "@/lib/server/http";
export async function DELETE(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const c = await context(true);
    z.object({ confirmation: z.literal("DELETE") })
      .strict()
      .parse(await body(request));
    const jar = await cookies();
    if (c.demo) {
      const token = jar.get(DEMO_COOKIE)?.value;
      if (token) deleteDemoSession(token);
      jar.delete(DEMO_COOKIE);
    } else {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
        throw new ApiError(
          503,
          "UNCONFIGURED",
          "Account deletion requires server administrator configuration.",
        );
      const admin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { error } = await admin.auth.admin.deleteUser(c.userId);
      if (error) throw error;
      await c.client!.auth.signOut({ scope: "local" });
    }
    return ok({ deleted: true });
  });
}
