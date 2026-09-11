import { session } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return route(async () => ok(await session()));
}
