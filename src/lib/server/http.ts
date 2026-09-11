import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./demo";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
export async function route(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    const known = error instanceof ApiError;
    const validation = error instanceof z.ZodError;
    return NextResponse.json(
      {
        error: {
          code: known
            ? error.code
            : validation
              ? "VALIDATION_ERROR"
              : "SERVER_ERROR",
          message: known
            ? error.message
            : validation
              ? "Invalid request. Check required fields and time ranges."
              : "The request could not be completed. Please retry.",
        },
      },
      {
        status: known ? error.status : validation ? 400 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin
    : new URL(request.url).origin;
  if (!origin || origin !== expectedOrigin)
    throw new ApiError(
      403,
      "ORIGIN_REJECTED",
      "A same-origin request is required.",
    );
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "CONTENT_TYPE", "JSON content is required.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, "EMPTY_BODY", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new ApiError(413, "BODY_TOO_LARGE", "Request exceeds 16 KB.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Invalid JSON.");
  }
}
const buckets = new Map<string, { count: number; until: number }>();
export function localLimit(key: string, limit = 60) {
  const now = Date.now();
  for (const [id, value] of buckets) if (value.until <= now) buckets.delete(id);
  const bucket = buckets.get(key) ?? { count: 0, until: now + 60000 };
  if (buckets.size > 10000 && !buckets.has(key))
    throw new ApiError(429, "RATE_LIMIT", "Please try again later.");
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > limit)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "Too many requests. Please wait one minute.",
    );
}
