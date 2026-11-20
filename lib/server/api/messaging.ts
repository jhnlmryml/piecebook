import { getSupabaseClient } from "@/lib/supabase";
import {
  messageAttachmentFileSchema,
  messageDraftSchema,
  messageEditSchema,
  MESSAGE_ATTACHMENT_MAX_COUNT,
} from "@/lib/form-schemas";
import type { Json, Tables, TablesInsert } from "@/types/supabase";
import {
  ApiError,
  databaseError,
  json,
  notFound,
  parseQuery,
  readFormData,
  readJson,
  requireUuid,
} from "@/lib/server/api-utils";
import { z } from "zod";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type MessageRow = Tables<"message">;
type ReactionRow = Tables<"message_reactions">;
type Attachment = {
  path: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
};

const uuidSchema = z.string().uuid();
const messageSchema = z.object({
  senderId: uuidSchema,
  recipientId: uuidSchema,
  body: z.string().max(1000),
  listingId: uuidSchema.nullable().optional(),
});
const actorSchema = z.object({ profileId: uuidSchema });
const markReadSchema = z.object({
  profileId: uuidSchema,
  senderId: uuidSchema,
});
const editMessageSchema = z.object({
  senderId: uuidSchema,
  body: messageEditSchema,
});
const reactionSchema = z.object({
  profileId: uuidSchema,
  reaction: z.string().trim().min(1).max(16),
});
const archiveSchema = z.object({
  profileId: uuidSchema,
  archived: z.boolean(),
});
const MESSAGE_BUCKET = "message-attachments";
const MESSAGE_PAGE_SIZE = 500;
const attachmentMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

function parseAttachments(value: Json | null): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Attachment =>
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    typeof entry.path === "string" &&
    typeof entry.url === "string" &&
    typeof entry.name === "string" &&
    typeof entry.contentType === "string" &&
    typeof entry.size === "number",
  );
}

function assertOwnedAttachmentPath(path: string, ownerId: string): string {
  const segments = path.split("/");
  if (
    segments.length !== 3 ||
    segments[0] !== ownerId ||
    segments[1] !== "messages" ||
    !segments[2] ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new ApiError(422, "INVALID_PATH", "The message attachment path is invalid.");
  }
  return path;
}

async function removeAttachments(paths: string[], ownerId: string) {
  const safePaths = [...new Set(paths.map((path) => assertOwnedAttachmentPath(path, ownerId)))];
  if (safePaths.length === 0) return;
  const { error } = await getSupabaseClient()
    .storage.from(MESSAGE_BUCKET)
    .remove(safePaths);
  if (error) databaseError("Could not remove message attachments", error);
}

function publicAttachment(path: string, file: File, contentType: string): Attachment {
  const bucket = getSupabaseClient().storage.from(MESSAGE_BUCKET);
  return {
    path,
    url: bucket.getPublicUrl(path).data.publicUrl,
    name: file.name,
    contentType,
    size: file.size,
  };
}

async function getHiddenIds(profileId: string) {
  const { data, error } = await getSupabaseClient()
    .from("message_hidden_for")
    .select("message_id")
    .eq("profile_id", profileId);
  if (error) databaseError("Could not load hidden messages", error);
  return new Set(data.map((row) => row.message_id));
}

async function getDeletedBefore(profileId: string) {
  const { data, error } = await getSupabaseClient()
    .from("message_conversation_preferences")
    .select("partner_id,deleted_before")
    .eq("profile_id", profileId)
    .not("deleted_before", "is", null);
  if (error) databaseError("Could not load conversation preferences", error);
  return new Map(
    data.flatMap((entry) =>
      entry.deleted_before
        ? [[entry.partner_id, entry.deleted_before] as const]
        : [],
    ),
  );
}

async function getMessages(profileId: string) {
  const supabase = getSupabaseClient();
  const rows: MessageRow[] = [];
  for (let offset = 0; ; offset += MESSAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("message")
      .select("*")
      .or(`sender_id.eq.${profileId},recipient_id.eq.${profileId}`)
      .order("created_at", { ascending: true })
      .range(offset, offset + MESSAGE_PAGE_SIZE - 1);
    if (error) databaseError("Could not load messages", error);
    rows.push(...data);
    if (data.length < MESSAGE_PAGE_SIZE) break;
  }

  const [hiddenIds, deletedBefore] = await Promise.all([
    getHiddenIds(profileId),
    getDeletedBefore(profileId),
  ]);
  const visible = rows.filter((message) => {
    if (hiddenIds.has(message.id)) return false;
    const partnerId =
      message.sender_id === profileId ? message.recipient_id : message.sender_id;
    const cutoff = deletedBefore.get(partnerId);
    return !cutoff || Date.parse(message.created_at) > Date.parse(cutoff);
  });
  if (visible.length === 0) return json([]);

  const reactions: ReactionRow[] = [];
  for (let offset = 0; offset < visible.length; offset += 100) {
    const batch = visible.slice(offset, offset + 100);
    const { data, error } = await supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", batch.map(({ id }) => id));
    if (error) databaseError("Could not load message reactions", error);
    reactions.push(...data);
  }

  return json(visible.map((message) => ({
    ...message,
    attachments: parseAttachments(message.attachments),
    reactions: reactions.filter((reaction) => reaction.message_id === message.id),
  })));
}

async function getUnreadCount(profileId: string) {
  const supabase = getSupabaseClient();
  const [hiddenIds, deletedBefore] = await Promise.all([
    getHiddenIds(profileId),
    getDeletedBefore(profileId),
  ]);
  let count = 0;
  for (let offset = 0; ; offset += MESSAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("message")
      .select("id,sender_id,created_at")
      .eq("recipient_id", profileId)
      .is("read_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + MESSAGE_PAGE_SIZE - 1);
    if (error) databaseError("Could not load unread message count", error);
    for (const message of data) {
      const cutoff = deletedBefore.get(message.sender_id);
      if (
        !hiddenIds.has(message.id) &&
        (!cutoff || Date.parse(message.created_at) > Date.parse(cutoff))
      ) {
        count += 1;
      }
    }
    if (data.length < MESSAGE_PAGE_SIZE) break;
  }
  return json({ count });
}

async function getConversationPreferences(profileId: string) {
  const { data, error } = await getSupabaseClient()
    .from("message_conversation_preferences")
    .select("*")
    .eq("profile_id", profileId);
  if (error) databaseError("Could not load conversation preferences", error);
  return json(data);
}

async function sendMessage(request: Request) {
  const formData = await readFormData(request, 51 * 1024 * 1024);
  const fileEntries = formData.getAll("files");
  if (fileEntries.some((entry) => !(entry instanceof File))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Each message attachment must be a file.");
  }
  const files = fileEntries.filter((entry): entry is File => entry instanceof File);
  const rawBody = formData.get("body");
  const rawSenderId = formData.get("senderId");
  const rawRecipientId = formData.get("recipientId");
  const rawListingId = formData.get("listingId");
  const parsedFields = messageSchema.safeParse({
    senderId: rawSenderId,
    recipientId: rawRecipientId,
    body: rawBody,
    listingId: typeof rawListingId === "string" && rawListingId ? rawListingId : null,
  });
  if (!parsedFields.success) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      parsedFields.error.issues[0]?.message ?? "The message request is invalid.",
    );
  }
  const validation = messageDraftSchema.safeParse({
    body: parsedFields.data.body,
    files: files.map(({ name, type, size }) => ({ name, type, size })),
  });
  if (!validation.success) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      validation.error.issues[0]?.message ?? "Check your message and attachments.",
    );
  }
  if (files.length > MESSAGE_ATTACHMENT_MAX_COUNT) {
    throw new ApiError(422, "VALIDATION_ERROR", "Too many message attachments.");
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Message attachments exceed the combined upload limit.");
  }
  if (parsedFields.data.senderId === parsedFields.data.recipientId) {
    throw new ApiError(422, "VALIDATION_ERROR", "You cannot message your own profile.");
  }

  const supabase = getSupabaseClient();
  const bucket = supabase.storage.from(MESSAGE_BUCKET);
  const uploaded: Attachment[] = [];
  try {
    for (const file of files) {
      const fileValidation = messageAttachmentFileSchema.safeParse(file);
      if (!fileValidation.success) {
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          fileValidation.error.issues[0]?.message ?? "Choose a valid attachment.",
        );
      }
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file";
      const contentType = attachmentMimeTypes[extension] || file.type || "application/octet-stream";
      const path = `${parsedFields.data.senderId}/messages/${crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(path, file, {
        contentType,
        upsert: false,
      });
      if (error) databaseError("Could not upload message attachment", error);
      uploaded.push(publicAttachment(path, file, contentType));
    }

    const row: TablesInsert<"message"> = {
      sender_id: parsedFields.data.senderId,
      recipient_id: parsedFields.data.recipientId,
      listing_id: parsedFields.data.listingId ?? null,
      body: validation.data.body,
      attachments: uploaded.length > 0 ? uploaded : null,
    };
    const { data, error } = await supabase
      .from("message")
      .insert(row)
      .select("*")
      .single();
    if (error) databaseError("Could not send message", error);
    return json(data, 201);
  } catch (error) {
    if (uploaded.length > 0) {
      try {
        await removeAttachments(
          uploaded.map(({ path }) => path),
          parsedFields.data.senderId,
        );
      } catch (cleanupError) {
        console.error(
          "Could not roll back message attachment uploads:",
          cleanupError instanceof Error ? cleanupError.message : "Unknown storage error.",
        );
      }
    }
    throw error;
  }
}

async function markRead(request: Request) {
  const { profileId, senderId } = await readJson(request, markReadSchema);
  const { error } = await getSupabaseClient()
    .from("message")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profileId)
    .eq("sender_id", senderId)
    .is("read_at", null);
  if (error) databaseError("Could not mark messages as read", error);
  return new Response(null, { status: 204 });
}

async function editMessage(request: Request, messageId: string) {
  const body = await readJson(request, editMessageSchema);
  const editableSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseClient()
    .from("message")
    .update({ body: body.body })
    .eq("id", messageId)
    .eq("sender_id", body.senderId)
    .gte("created_at", editableSince)
    .select("*")
    .maybeSingle();
  if (error) databaseError("Could not edit message", error);
  if (!data) notFound("This message can no longer be edited.");
  return json(data);
}

async function deleteMessageForEveryone(request: Request, messageId: string) {
  const senderId = requireUuid(new URL(request.url).searchParams.get("senderId"), "senderId");
  const supabase = getSupabaseClient();
  const { data: message, error: loadError } = await supabase
    .from("message")
    .select("attachments")
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .maybeSingle();
  if (loadError) databaseError("Could not load message attachments", loadError);
  if (!message) notFound("The message was not found or does not belong to this profile.");

  const { data, error } = await supabase
    .from("message")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .select("id")
    .maybeSingle();
  if (error) databaseError("Could not delete message", error);
  if (!data) notFound("The message was not found or does not belong to this profile.");

  const paths = parseAttachments(message.attachments)
    .map(({ path }) => path)
    .filter((path) => path.startsWith(`${senderId}/messages/`));
  let cleanupWarning: string | null = null;
  try {
    await removeAttachments(paths, senderId);
  } catch (error) {
    cleanupWarning = error instanceof Error
      ? error.message
      : "Attachments could not be removed from storage.";
  }
  return json({ cleanupWarning });
}

async function hideMessage(request: Request, messageId: string) {
  const { profileId } = await readJson(request, actorSchema);
  const { error } = await getSupabaseClient()
    .from("message_hidden_for")
    .upsert(
      { message_id: messageId, profile_id: profileId },
      { onConflict: "profile_id,message_id", ignoreDuplicates: true },
    );
  if (error) databaseError("Could not hide message", error);
  return new Response(null, { status: 204 });
}

async function setReaction(request: Request, messageId: string, remove: boolean) {
  const supabase = getSupabaseClient();
  if (remove) {
    const { profileId } = await readJson(request, actorSchema);
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", profileId);
    if (error) databaseError("Could not remove message reaction", error);
    return new Response(null, { status: 204 });
  }
  const { profileId, reaction } = await readJson(request, reactionSchema);
  const { data, error } = await supabase
    .from("message_reactions")
    .upsert(
      { message_id: messageId, user_id: profileId, reaction },
      { onConflict: "message_id,user_id" },
    )
    .select("*")
    .single();
  if (error) databaseError("Could not set message reaction", error);
  return json(data);
}

async function archiveConversation(request: Request, partnerId: string) {
  const { profileId, archived } = await readJson(request, archiveSchema);
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseClient()
    .from("message_conversation_preferences")
    .upsert(
      {
        profile_id: profileId,
        partner_id: partnerId,
        archived,
        updated_at: now,
      },
      { onConflict: "profile_id,partner_id" },
    )
    .select("*")
    .single();
  if (error) databaseError("Could not update conversation preference", error);
  return json(data);
}

async function deleteConversation(request: Request, partnerId: string) {
  const { profileId } = await readJson(request, actorSchema);
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseClient()
    .from("message_conversation_preferences")
    .upsert(
      {
        profile_id: profileId,
        partner_id: partnerId,
        archived: false,
        deleted_before: now,
        updated_at: now,
      },
      { onConflict: "profile_id,partner_id" },
    )
    .select("*")
    .single();
  if (error) databaseError("Could not delete conversation", error);
  return json(data);
}

async function downloadAttachment(path: string[]) {
  if (path.length !== 3) {
    throw new ApiError(404, "NOT_FOUND", "The attachment was not found.");
  }
  const ownerId = parseQuery(path[0], uuidSchema);
  const attachmentPath = assertOwnedAttachmentPath(
    `${ownerId}/${path[1]}/${path[2]}`,
    ownerId,
  );
  const { data, error } = await getSupabaseClient()
    .storage.from(MESSAGE_BUCKET)
    .download(attachmentPath);
  if (error) {
    if ("statusCode" in error && String(error.statusCode) === "404") {
      notFound("The attachment was not found.");
    }
    databaseError("Could not download message attachment", error);
  }

  const name = path[2].replace(/[\r\n"]/g, "");
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function handleMessagingApi(
  request: Request,
  method: Method,
  path: string[],
): Promise<Response | null> {
  if (path[0] === "messages") {
    if (path.length === 1 && method === "GET") {
      const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
      return getMessages(profileId);
    }
    if (path.length === 1 && method === "POST") return sendMessage(request);
    if (path.length === 2 && path[1] === "unread-count" && method === "GET") {
      const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
      return getUnreadCount(profileId);
    }
    if (path.length === 2 && path[1] === "read" && method === "POST") {
      return markRead(request);
    }
    if (path.length === 2) {
      const messageId = parseQuery(path[1], uuidSchema);
      if (method === "PATCH") return editMessage(request, messageId);
      if (method === "DELETE") return deleteMessageForEveryone(request, messageId);
    }
    if (path.length === 3 && path[2] === "hidden" && method === "POST") {
      return hideMessage(request, parseQuery(path[1], uuidSchema));
    }
    if (path.length === 3 && path[2] === "reactions") {
      const messageId = parseQuery(path[1], uuidSchema);
      if (method === "PUT") return setReaction(request, messageId, false);
      if (method === "DELETE") return setReaction(request, messageId, true);
    }
  }
  if (path[0] === "conversations") {
    if (path.length === 1 && method === "GET") {
      const profileId = requireUuid(new URL(request.url).searchParams.get("profileId"), "profileId");
      return getConversationPreferences(profileId);
    }
    if (path.length === 2) {
      const partnerId = parseQuery(path[1], uuidSchema);
      if (method === "PATCH") return archiveConversation(request, partnerId);
      if (method === "DELETE") return deleteConversation(request, partnerId);
    }
  }
  if (path[0] === "message-attachments" && method === "GET") {
    return downloadAttachment(path.slice(1));
  }
  return null;
}
