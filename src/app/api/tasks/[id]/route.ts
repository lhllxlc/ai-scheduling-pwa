import { z } from "zod";
import { taskInputSchema, taskPatchSchema } from "@/lib/ai/schemas";
import { context } from "@/lib/server/auth";
import { body, checkOrigin, ok, route } from "@/lib/server/http";
import { deleteTask, getTask, updateTask } from "@/lib/server/repository";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, props: Params) {
  return route(async () => {
    checkOrigin(request);
    const c = await context(true);
    const id = z.uuid().parse((await props.params).id);
    const patch = taskPatchSchema.parse(await body(request));
    const old = await getTask(c, id);
    const {
      id: _id,
      userId: _userId,
      status,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...input
    } = old;
    void _id;
    void _userId;
    void _createdAt;
    void _updatedAt;
    const { status: nextStatus, ...fields } = patch;
    return ok(
      await updateTask(
        c,
        id,
        taskInputSchema.parse({ ...input, ...fields }),
        nextStatus ?? status,
      ),
    );
  });
}
export async function DELETE(request: Request, props: Params) {
  return route(async () => {
    checkOrigin(request);
    return ok(
      await deleteTask(
        await context(true),
        z.uuid().parse((await props.params).id),
      ),
    );
  });
}
