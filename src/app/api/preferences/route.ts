import { preferencesSchema } from "@/lib/ai/schemas";
import { context } from "@/lib/server/auth";
import { body, checkOrigin, ok, route } from "@/lib/server/http";
import { getPreferences, putPreferences } from "@/lib/server/repository";
export async function GET() {
  return route(async () => ok(await getPreferences(await context())));
}
export async function PUT(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const c = await context(true);
    return ok(
      await putPreferences(c, preferencesSchema.parse(await body(request))),
    );
  });
}
