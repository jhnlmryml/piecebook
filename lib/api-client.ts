export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/v1/${path.replace(/^\/+/, "")}`, {
    cache: "no-store",
    ...init,
  });

  if (response.status === 204) return undefined as T;

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new ApiRequestError(
      response.ok
        ? "The server returned an invalid response."
        : "The request could not be completed.",
      response.status,
    );
  }

  if (!response.ok) {
    const error =
      typeof result === "object" && result !== null
        ? (result as ApiErrorResponse)
        : {};
    throw new ApiRequestError(
      error.error?.message ?? "The request could not be completed.",
      response.status,
      error.error?.code,
    );
  }

  return result as T;
}

export async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(`/api/v1/${path.replace(/^\/+/, "")}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "The request could not be completed.";
    try {
      const payload: unknown = await response.json();
      const error =
        typeof payload === "object" && payload !== null
          ? (payload as ApiErrorResponse)
          : {};
      message = error.error?.message ?? message;
    } catch {
      // The response body may not contain JSON.
    }
    throw new ApiRequestError(message, response.status);
  }
  return response.blob();
}

export function jsonRequest(method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
