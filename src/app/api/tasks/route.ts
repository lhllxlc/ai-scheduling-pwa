import { z } from "zod";
import { taskInputSchema } from "@/lib/ai/schemas";
import { context } from "@/lib/server/auth";
import { body, checkOrigin, ok, route } from "@/lib/server/http";
import { createTask, listTasks } from "@/lib/server/repository";
export async function GET() {
  return route(async () => ok(await listTasks(await context())));
}
export async function POST(request: Request) {
  return route(async () => {
    checkOrigin(request);
    const c = await context(true);
    const key = z.uuid().parse(request.headers.get("idempotency-key"));
    return ok(
      await createTask(c, taskInputSchema.parse(await body(request)), key),
      201,
    );
  });
}
