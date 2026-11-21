"use client";

import type { SubmitEventHandler } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_MAX_LENGTH } from "@/lib/form-schemas";
import { PostComposerInput } from "@/components/features/posts/PostComposerInput";
import { Button } from "@/components/ui/button";
import type { MessageWithReactions } from "@/lib/messaging";
import {
  MESSAGE_ATTACHMENT_ACCEPT,
  MESSAGE_ATTACHMENT_MAX_COUNT,
  MESSAGE_ATTACHMENT_MAX_SIZE,
  validateMessageAttachment,
} from "@/lib/messaging";
import type { MarketplaceMessageListing } from "@/lib/messaging-events";
import { MarketplaceListingContextCard } from "./MarketplaceMessageCards";

type MessagingComposerProps = {
  profileId: string;
  canSend: boolean;
  draft: string;
  files: File[];
  isSending: boolean;
  error: string | null;
  marketplaceContext: MarketplaceMessageListing | null;
  editingMessageId: string | null;
  editingMessage: MessageWithReactions | null;
  editDraft: string;
  onDraftChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onEditDraftChange: (value: string) => void;
  onSubmit: SubmitEventHandler<HTMLFormElement>;
  onCancelEdit: () => void;
  onViewListing: () => void;
};

export function MessagingComposer({
  profileId,
  canSend,
  draft,
  files,
  isSending,
  error,
  marketplaceContext,
  editingMessageId,
  editingMessage,
  editDraft,
  onDraftChange,
  onFilesChange,
  onEditDraftChange,
  onSubmit,
  onCancelEdit,
  onViewListing,
}: MessagingComposerProps) {
  const isEditing = editingMessageId !== null;

  return (
    <div className="shrink-0 border-t border-border/70 bg-card/95 p-3 sm:p-4">
      {marketplaceContext && (
        <div className="mb-3 overflow-hidden rounded-2xl">
          <MarketplaceListingContextCard
            listing={marketplaceContext}
            onViewListing={onViewListing}
          />
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <PostComposerInput
        variant="comment"
        id={`message-${profileId}`}
        value={isEditing ? editDraft : draft}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder={isEditing ? "Edit message…" : "Write a message…"}
        disabled={!canSend || isSending}
        canSubmit={Boolean(
          (isEditing ? editDraft.trim() : draft.trim() || files.length > 0) && !isSending,
        )}
        isSubmitting={isSending}
        onChange={isEditing ? onEditDraftChange : onDraftChange}
        onSubmit={onSubmit}
        header={
          editingMessage ? (
            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-background/80 px-2 py-1">
              <Pencil aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 border-l-2 border-primary/70 pl-2">
                <p className="text-[11px] font-medium text-primary">Editing message</p>
                <p className="truncate text-xs text-muted-foreground">{editingMessage.body}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel editing"
                disabled={isSending}
                onClick={onCancelEdit}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : undefined
        }
        preserveMultiline
        textareaRows={2}
        textareaKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        textareaClassName="field-sizing-content min-h-10 max-h-28 w-full min-w-0 flex-1 resize-none overflow-y-auto whitespace-pre-wrap border-0 bg-transparent px-1 py-2 text-sm leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
        fieldClassName="relative flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-xl bg-muted/35 px-2 py-1"
        footerClassName="flex shrink-0 items-center justify-between"
        fileUpload={
          isEditing
            ? undefined
            : {
                value: files,
                onValueChange: onFilesChange,
                onFileReject: (file, reason) => toast.error(`${file.name}: ${reason}`),
                onFileValidate: validateMessageAttachment,
                accept: MESSAGE_ATTACHMENT_ACCEPT,
                maxFiles: MESSAGE_ATTACHMENT_MAX_COUNT,
                maxSize: MESSAGE_ATTACHMENT_MAX_SIZE,
                multiple: true,
                attachmentLabel: "Attach photos or files",
                dropzoneTitle: "Drop photos or files to attach",
                dropzoneDescription: `Up to ${MESSAGE_ATTACHMENT_MAX_COUNT} files, max ${MESSAGE_ATTACHMENT_MAX_SIZE / 1024 / 1024} MB each`,
              }
        }
        submitButtonSize="icon-lg"
        submitIcon={isEditing ? <Check aria-hidden="true" className="size-4" /> : undefined}
        submitAriaLabel={isEditing ? "Save edited message" : "Send message"}
      />
    </div>
  );
}
