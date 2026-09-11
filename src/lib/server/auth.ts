import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ApiError, demoEnabled, getDemoSession } from "./demo";
import { localLimit } from "./http";

export const DEMO_COOKIE = "dayweave-demo";
export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
export async function supabase() {
  if (!configured())
    throw new ApiError(503, "UNCONFIGURED", "Supabase is not configured.");
  const jar = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            }),
          ),
      },
    },
  );
}
export async function session() {
  if (configured()) {
    const client = await supabase();
    const { data, error } = await client.auth.getUser();
    return {
      user:
        error || !data.user
          ? null
          : { id: data.user.id, email: data.user.email ?? "" },
      mode: "supabase" as const,
    };
  }
  if (demoEnabled()) {
    const data = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
    return {
      user: data
        ? { id: data.userId, email: "local-demo@example.invalid" }
        : null,
      mode: "demo" as const,
    };
  }
  return { user: null, mode: "unconfigured" as const };
}
export async function context(mutation = false) {
  if (configured()) {
    const client = await supabase();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user)
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in.");
    if (mutation) {
      const result = await client.rpc("consume_rate_limit");
      if (result.error)
        throw new ApiError(
          503,
          "RATE_LIMIT_UNAVAILABLE",
          "Please try again later.",
        );
      if (!result.data)
        throw new ApiError(
          429,
          "RATE_LIMIT",
          "Too many requests. Please wait one minute.",
        );
    }
    return { userId: data.user.id, client, demo: undefined };
  }
  if (!demoEnabled())
    throw new ApiError(503, "UNCONFIGURED", "Supabase is not configured.");
  const demo = getDemoSession((await cookies()).get(DEMO_COOKIE)?.value);
  if (!demo)
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Please start a local demo session.",
    );
  if (mutation) localLimit(demo.userId);
  return { userId: demo.userId, client: undefined, demo };
}
