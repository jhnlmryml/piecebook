import type { Message } from "@/lib/messaging";

export const MESSAGE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
export const MARKETPLACE_MESSAGE_PREFILL = "Hi, is this still available?";

const MESSAGE_EDIT_WINDOW_MS = 30 * 60 * 1000;

export function isWithinEditWindow(message: Pick<Message, "created_at">, now: number) {
  return now - new Date(message.created_at).getTime() < MESSAGE_EDIT_WINDOW_MS;
}
