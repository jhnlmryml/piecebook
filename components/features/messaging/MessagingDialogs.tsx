"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MessageDeleteTarget } from "./messaging-types";

type MessagingDialogsProps = {
  deleteTarget: MessageDeleteTarget | null;
  deleteConversationTarget: string | null;
  onCloseMessageDialog: () => void;
  onDeleteMessage: () => void | Promise<void>;
  onCloseConversationDialog: () => void;
  onDeleteConversation: () => void | Promise<void>;
};

export function MessagingDialogs({
  deleteTarget,
  deleteConversationTarget,
  onCloseMessageDialog,
  onDeleteMessage,
  onCloseConversationDialog,
  onDeleteConversation,
}: MessagingDialogsProps) {
  return (
    <>
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && onCloseMessageDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.mode === "everyone"
                ? "Delete this message for everyone?"
                : "Delete this message for you?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.mode === "everyone"
                ? "This permanently removes the message and its attachments from the conversation for all participants."
                : "This removes the message from your view only. Other participants can still see it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void onDeleteMessage()}>
              {deleteTarget?.mode === "everyone" ? "Delete for everyone" : "Delete for me"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteConversationTarget !== null}
        onOpenChange={(open) => !open && onCloseConversationDialog()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation for you?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the conversation and its messages from your inbox. It does not delete
              messages for the other person.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void onDeleteConversation()}
            >
              Delete conversation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
