import { cookies } from "next/headers";
import { z } from "zod";
import { configured, DEMO_COOKIE, session, supabase } from "@/lib/server/auth";
import {
  ApiError,
  createDemoSession,
  deleteDemoSession,
  demoEnabled,
} from "@/lib/server/demo";
import { body, checkOrigin, localLimit, ok, route } from "@/lib/server/http";
const schema = z
  .object({
    action: z.enum(["login", "signup", "logout", "demo"]),
    email: z.email().max(254).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .strict();
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    localLimit(
      "auth:" +
        (request.headers.get("x-forwarded-for")?.split(",")[0]?.slice(0, 100) ??
          "local"),
      12,
    );
    const input = schema.parse(await body(request));
    const jar = await cookies();
    if (input.action === "demo") {
      if (configured() || !demoEnabled())
        throw new ApiError(503, "DEMO_DISABLED", "Local demo is disabled.");
      const old = jar.get(DEMO_COOKIE)?.value;
      if (old) deleteDemoSession(old);
      jar.set(DEMO_COOKIE, createDemoSession(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 86400,
      });
      return ok(await session());
    }
    if (input.action === "logout") {
      const token = jar.get(DEMO_COOKIE)?.value;
      if (token) deleteDemoSession(token);
      jar.delete(DEMO_COOKIE);
      if (configured()) {
        const { error } = await (await supabase()).auth.signOut();
        if (error)
          throw new ApiError(
            503,
            "AUTH_UNAVAILABLE",
            "Unable to sign out. Please retry.",
          );
      }
      return ok(await session());
    }
    if (!input.email || !input.password)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Email and password are required.",
      );
    const client = await supabase();
    const credentials = { email: input.email, password: input.password };
    const result =
      input.action === "login"
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp(credentials);
    if (result.error)
      throw new ApiError(
        400,
        "AUTH_ERROR",
        "Authentication failed. Check your details or try again later.",
      );
    return ok({
      ...(await session()),
      ...(input.action === "signup" && !result.data.session
        ? { message: "Check your email to confirm your account, then sign in." }
        : {}),
    });
  });
}
