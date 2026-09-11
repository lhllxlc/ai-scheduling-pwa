import { context } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";
import { getPreferences, listTasks } from "@/lib/server/repository";
export async function GET() {
  return route(async () => {
    const c = await context();
    const [preferences, tasks] = await Promise.all([
      getPreferences(c),
      listTasks(c),
    ]);
    const response = ok({ preferences, tasks });
    response.headers.set(
      "Content-Disposition",
      'attachment; filename="dayweave-export.json"',
    );
    return response;
  });
}
