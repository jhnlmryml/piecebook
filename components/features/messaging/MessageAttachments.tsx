"use client";

import { useState } from "react";
import { Download, LoaderCircle, Paperclip } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadMessageAttachment,
  type MessageAttachment,
} from "@/lib/messaging";

function getSafeAttachmentUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;

    const storageUrl = new URL(supabaseUrl);
    const storagePath = `${storageUrl.pathname.replace(/\/$/, "")}/storage/v1/object/public/message-attachments/`;
    return (
      parsedUrl.origin === storageUrl.origin &&
      parsedUrl.pathname.startsWith(storagePath)
    )
      ? parsedUrl.href
      : null;
  } catch {
    return null;
  }
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachments({
  attachments,
}: {
  attachments: MessageAttachment[];
}) {
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function saveToDevice(attachment: MessageAttachment) {
    if (downloadingPath) return;
    setDownloadingPath(attachment.path);
    try {
      const file = await downloadMessageAttachment(attachment.path);
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name || "attachment";
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success("Download started.");
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not download attachment.",
      );
    } finally {
      setDownloadingPath(null);
    }
  }

  return (
    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
      {attachments.map((attachment) => {
        const url = getSafeAttachmentUrl(attachment.url);
        if (!url) return null;

        if (attachment.contentType.startsWith("image/")) {
          return (
            <div key={attachment.path} className="relative max-w-full">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open image ${attachment.name}`}
                className="block max-w-full overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Image
                  src={url}
                  alt={attachment.name}
                  width={480}
                  height={360}
                  unoptimized
                  className="h-auto max-h-64 max-w-full rounded-xl object-contain"
                />
              </a>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label={`Save ${attachment.name} to device`}
                title="Save to device"
                disabled={downloadingPath !== null}
                onClick={() => void saveToDevice(attachment)}
                className="absolute right-2 bottom-2 rounded-full shadow-md"
              >
                {downloadingPath === attachment.path ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Download aria-hidden="true" />
                )}
              </Button>
            </div>
          );
        }

        return (
          <div
            key={attachment.path}
            className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-current/15 bg-background/20 p-1.5 text-xs"
          >
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-2 rounded-md px-1 hover:bg-background/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Paperclip aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 py-1">
                <span className="block truncate font-medium">{attachment.name}</span>
                <span className="block text-[10px] opacity-70">
                  {formatFileSize(attachment.size)}
                </span>
              </span>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Save ${attachment.name} to device`}
              title="Save to device"
              disabled={downloadingPath !== null}
              onClick={() => void saveToDevice(attachment)}
              className="ml-auto shrink-0 rounded-full"
            >
              {downloadingPath === attachment.path ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Download aria-hidden="true" />
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
