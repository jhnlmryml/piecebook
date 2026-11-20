import { handleMarketplaceApi } from "@/lib/server/api/marketplace";
import { handleMessagingApi } from "@/lib/server/api/messaging";
import { handleProfilePostsApi } from "@/lib/server/api/profile-posts";
import { apiErrorResponse, json } from "@/lib/server/api-utils";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function getAllowedMethods(path: string[]): Method[] | null {
  if (path[0] === "profiles") {
    if (path.length === 1) return ["GET"];
    if (path.length === 2) return ["PATCH"];
  }
  if (path[0] === "posts") {
    if (path.length === 1) return ["GET", "POST"];
    if (path.length === 2) return ["GET", "DELETE"];
    if (path.length === 3 && path[2] === "likes") return ["PUT", "DELETE"];
    if (path.length === 3 && path[2] === "comments") return ["GET", "POST"];
    if (path.length === 4 && path[2] === "comments" && path[3] === "count") return ["GET"];
    if (path.length === 4 && path[2] === "comments") return ["DELETE"];
  }
  if (path[0] === "uploads" && path.length === 2) return ["POST", "DELETE"];
  if (path[0] === "marketplace") {
    if (path.length === 2 && ["orders", "listing-counts"].includes(path[1])) {
      return ["GET"];
    }
    if (path.length === 2 && path[1] === "listings") return ["GET", "POST"];
    if (path.length === 3 && path[1] === "orders") return ["GET"];
    if (path.length === 3 && path[1] === "listings") return ["GET", "PATCH", "DELETE"];
    if (path.length === 4 && path[1] === "listings") {
      if (path[3] === "message-card" || path[3] === "engagement" || path[3] === "availability" || path[3] === "messages") {
        return ["GET"];
      }
      if (path[3] === "likes") return ["PUT", "DELETE"];
      if (path[3] === "comments") return ["GET", "POST"];
    }
    if (path.length === 5 && path[1] === "listings" && path[3] === "comments") {
      return ["DELETE"];
    }
    if (path.length === 5 && path[1] === "listings" && path[3] === "engagement" && path[4] === "archive") {
      return ["GET"];
    }
    if (path.length === 4 && path[1] === "messages" && path[3] === "reactions") {
      return ["PUT", "DELETE"];
    }
  }
  if (path[0] === "messages") {
    if (path.length === 1) return ["GET", "POST"];
    if (path.length === 2 && path[1] === "unread-count") return ["GET"];
    if (path.length === 2 && path[1] === "read") return ["POST"];
    if (path.length === 2) return ["PATCH", "DELETE"];
    if (path.length === 3 && path[2] === "hidden") return ["POST"];
    if (path.length === 3 && path[2] === "reactions") return ["PUT", "DELETE"];
  }
  if (path[0] === "conversations") {
    if (path.length === 1) return ["GET"];
    if (path.length === 2) return ["PATCH", "DELETE"];
  }
  if (path[0] === "message-attachments" && path.length === 4) return ["GET"];
  return null;
}

async function dispatch(
  request: Request,
  method: Method,
  context: RouteContext,
): Promise<Response> {
  try {
    const { path } = await context.params;
    const response =
      (await handleProfilePostsApi(request, method, path)) ??
      (await handleMarketplaceApi(request, method, path)) ??
      (await handleMessagingApi(request, method, path));

    if (response) return response;
    const allowedMethods = getAllowedMethods(path);
    if (allowedMethods) {
      return Response.json(
        {
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "This HTTP method is not supported for the resource.",
          },
        },
        { status: 405, headers: { Allow: allowedMethods.join(", ") } },
      );
    }
    return json(
      { error: { code: "NOT_FOUND", message: "The API resource was not found." } },
      404,
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function GET(request: Request, context: RouteContext) {
  return dispatch(request, "GET", context);
}

export function POST(request: Request, context: RouteContext) {
  return dispatch(request, "POST", context);
}

export function PUT(request: Request, context: RouteContext) {
  return dispatch(request, "PUT", context);
}

export function PATCH(request: Request, context: RouteContext) {
  return dispatch(request, "PATCH", context);
}

export function DELETE(request: Request, context: RouteContext) {
  return dispatch(request, "DELETE", context);
}
