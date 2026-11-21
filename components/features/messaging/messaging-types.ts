import type { MessageWithReactions } from "@/lib/messaging";

export type MessagingConversation = {
  profileId: string;
  messages: MessageWithReactions[];
  latest: MessageWithReactions;
  unread: number;
  archived: boolean;
};

export type MessageSenderGroup = {
  senderId: string;
  messages: MessageWithReactions[];
};

export type MessageDeleteTarget = {
  messageId: string;
  mode: "me" | "everyone";
};
