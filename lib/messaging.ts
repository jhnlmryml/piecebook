import type { Json, Tables } from "@/types/supabase";
import {
  messageAttachmentFileSchema,
  messageDraftSchema,
  messageEditSchema,
} from "@/lib/form-schemas";
import {
  apiBlobRequest,
  apiRequest,
  jsonRequest,
} from "@/lib/api-client";

export {
  MESSAGE_ATTACHMENT_MAX_COUNT,
  MESSAGE_ATTACHMENT_MAX_SIZE,
} from "@/lib/form-schemas";

export type Message = Tables<"message">;
export type MessageReaction = Tables<"message_reactions">;
export type MessageAttachment = {
  path: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
};
export type MessageWithReactions = Omit<Message, "attachments"> & {
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
};
export type MessageConversationPreference = Tables<"message_conversation_preferences">;

export const MESSAGE_ATTACHMENT_ACCEPT =
  "image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif,.bmp,.svg,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

function isMessageAttachment(value: Json): value is MessageAttachment {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.path === "string" &&
    typeof value.url === "string" &&
    typeof value.name === "string" &&
    typeof value.contentType === "string" &&
    typeof value.size === "number"
  );
}

export function parseMessageAttachments(value: Json | null): MessageAttachment[] {
  return Array.isArray(value) ? value.filter(isMessageAttachment) : [];
}

export function toMessageWithReactions(
  message: Message,
  reactions: MessageReaction[] = [],
): MessageWithReactions {
  const { attachments, ...messageFields } = message;
  return {
    ...messageFields,
    attachments: parseMessageAttachments(attachments),
    reactions,
  };
}

export function validateMessageAttachment(file: File): string | null {
  const validation = messageAttachmentFileSchema.safeParse(file);
  return validation.success
    ? null
    : validation.error.issues[0]?.message ?? "Choose a valid attachment.";
}

export async function downloadMessageAttachment(path: string): Promise<Blob> {
  const pathSegments = path.split("/");
  if (
    pathSegments.length !== 3 ||
    !pathSegments[0] ||
    pathSegments[1] !== "messages" ||
    !pathSegments[2] ||
    pathSegments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("This attachment path is invalid.");
  }
  const apiPath = ["message-attachments", ...pathSegments]
    .map(encodeURIComponent)
    .join("/");
  return apiBlobRequest(apiPath);
}

export async function getMessages(profileId: string): Promise<MessageWithReactions[]> {
  return apiRequest(`messages?profileId=${encodeURIComponent(profileId)}`);
}

export async function getMessageConversationPreferences(
  profileId: string,
): Promise<MessageConversationPreference[]> {
  return apiRequest(
    `conversations?profileId=${encodeURIComponent(profileId)}`,
  );
}

export async function getUnreadMessageCount(profileId: string): Promise<number> {
  const result = await apiRequest<{ count: number }>(
    `messages/unread-count?profileId=${encodeURIComponent(profileId)}`,
  );
  return result.count;
}

export async function sendMessage({
  senderId,
  recipientId,
  body,
  files = [],
  listingId,
}: {
  senderId: string;
  recipientId: string;
  body: string;
  files?: File[];
  listingId?: string | null;
}): Promise<Message> {
  const validation = messageDraftSchema.safeParse({ body, files });
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Check your message and try again.",
    );
  }
  if (senderId === recipientId) {
    throw new Error("You cannot message your own profile.");
  }
  const formData = new FormData();
  formData.append("senderId", senderId);
  formData.append("recipientId", recipientId);
  formData.append("body", validation.data.body);
  if (listingId) formData.append("listingId", listingId);
  files.forEach((file) => formData.append("files", file));
  return apiRequest<Message>("messages", { method: "POST", body: formData });
}

export async function markMessagesRead(
  profileId: string,
  senderId: string,
): Promise<void> {
  await apiRequest<void>(
    "messages/read",
    jsonRequest("POST", { profileId, senderId }),
  );
}

export async function editMessage(
  messageId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const validation = messageEditSchema.safeParse(body);
  if (!validation.success) {
    throw new Error(
      validation.error.issues[0]?.message ?? "Check your message and try again.",
    );
  }
  return apiRequest<Message>(
    `messages/${encodeURIComponent(messageId)}`,
    jsonRequest("PATCH", { senderId, body: validation.data }),
  );
}

export async function deleteMessageForEveryone(
  messageId: string,
  senderId: string,
): Promise<{ cleanupWarning: string | null }> {
  return apiRequest(
    `messages/${encodeURIComponent(messageId)}?senderId=${encodeURIComponent(senderId)}`,
    { method: "DELETE" },
  );
}

export async function deleteMessageForMe(
  messageId: string,
  profileId: string,
): Promise<void> {
  await apiRequest<void>(
    `messages/${encodeURIComponent(messageId)}/hidden`,
    jsonRequest("POST", { profileId }),
  );
}

export async function setConversationArchived(
  profileId: string,
  partnerId: string,
  archived: boolean,
): Promise<MessageConversationPreference> {
  return apiRequest(
    `conversations/${encodeURIComponent(partnerId)}`,
    jsonRequest("PATCH", { profileId, archived }),
  );
}

export async function deleteConversationForMe(
  profileId: string,
  partnerId: string,
): Promise<MessageConversationPreference> {
  return apiRequest(
    `conversations/${encodeURIComponent(partnerId)}`,
    jsonRequest("DELETE", { profileId }),
  );
}

