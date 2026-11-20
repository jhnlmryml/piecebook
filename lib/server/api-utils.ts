import { z, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status });
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  if (error instanceof z.ZodError) {
    return json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "The request is invalid.",
        },
      },
      422,
    );
  }

  console.error(
    "Unhandled API request error:",
    error instanceof Error ? error.message : "Unknown server error.",
  );
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    },
    500,
  );
}

export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }

  const validation = schema.safeParse(payload);
  if (!validation.success) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "The request is invalid.",
    );
  }
  return validation.data;
}

export async function readFormData(
  request: Request,
  maxBytes = 52 * 1024 * 1024,
): Promise<FormData> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be multipart/form-data.");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The uploaded files exceed the request size limit.");
  }
  try {
    return await request.formData();
  } catch {
    throw new ApiError(400, "INVALID_FORM_DATA", "The upload form is invalid.");
  }
}

export function parseQuery<T>(value: unknown, schema: ZodType<T>): T {
  const validation = schema.safeParse(value);
  if (!validation.success) {
    throw new ApiError(
      400,
      "INVALID_QUERY",
      validation.error.issues[0]?.message ?? "The query parameters are invalid.",
    );
  }
  return validation.data;
}

export function databaseError(
  context: string,
  error: { code?: string; message: string },
): never {
  console.error(`${context}:`, error.code ?? "UNKNOWN", error.message);
  if (error.code === "23505" || error.code === "P0001") {
    throw new ApiError(409, "CONFLICT", "The request conflicts with current data.");
  }
  throw new ApiError(500, "DATABASE_ERROR", "The request could not be completed.");
}

export function notFound(message = "The requested resource was not found."): never {
  throw new ApiError(404, "NOT_FOUND", message);
}

export function requireUuid(value: string | null, label: string): string {
  const validation = z.string().uuid().safeParse(value);
  if (!validation.success) {
    throw new ApiError(400, "INVALID_QUERY", `${label} must be a valid ID.`);
  }
  return validation.data;
}
