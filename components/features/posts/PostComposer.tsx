"use client";

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Loader2, Paperclip, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  FileUpload,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
  type FileUploadProps,
} from "@/components/ui/file-upload";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { getInitials } from "@/lib/get-initials";
import {
  createWallPost,
  POST_IMAGE_BUCKET,
  type WallPost,
} from "@/lib/posts";
import { getSupabaseClient } from "@/lib/supabase";

const MAX_CHARS = 280;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);
const IMAGE_ACCEPT_ATTRIBUTE = Array.from(ACCEPTED_IMAGE_TYPES).join(",");

type PostComposerProps = {
  onPostCreated: (post: WallPost) => void;
};

type UploadedImage = {
  ownerId: string;
  objectPath: string;
  publicUrl: string;
};

type UploadedImageMap = Map<File, UploadedImage>;

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { currentUser } = useAuth();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageMap>(
    () => new Map(),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const removeUnusedImages = useCallback(async (objectPaths: string[]) => {
    if (objectPaths.length === 0) return;

    try {
      const { error } = await getSupabaseClient()
        .storage.from(POST_IMAGE_BUCKET)
        .remove(objectPaths);

      if (error) throw error;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Could not remove unused photos: ${error.message}`
          : "Could not remove unused photos.",
      );
    }
  }, []);

  const onUpload: NonNullable<FileUploadProps["onUpload"]> = useCallback(async (
    uploadFiles,
    { onProgress, onSuccess, onError },
  ) => {
    if (!currentUser) {
      toast.error("Choose a profile before uploading photos.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = getSupabaseClient();
      const imageBucket = supabase.storage.from(POST_IMAGE_BUCKET);

      await Promise.all(
        uploadFiles.map(async (file) => {
          try {
            const safeFileName = file.name
              .replace(/[^a-zA-Z0-9._-]/g, "-")
              .slice(0, 120);
            const objectPath = `${currentUser.id}/${crypto.randomUUID()}-${safeFileName}`;
            const { error } = await imageBucket.upload(objectPath, file, {
              contentType: file.type,
            });

            if (error) throw error;

            const { data } = imageBucket.getPublicUrl(objectPath);
            setUploadedImages((images) =>
              new Map(images).set(file, {
                ownerId: currentUser.id,
                objectPath,
                publicUrl: data.publicUrl,
              }),
            );
            onProgress(file, 100);
            onSuccess(file);
          } catch (error) {
            const uploadError =
              error instanceof Error
                ? error
                : new Error("Photo upload failed.");
            onError(file, uploadError);
            toast.error(uploadError.message);
          }
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Photo upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }, [currentUser]);

  const handleFilesChange = useCallback((nextFiles: File[]) => {
    const nextFileSet = new Set(nextFiles);
    const removedFiles = files.filter((file) => !nextFileSet.has(file));
    const removedObjectPaths = removedFiles
      .map((file) => uploadedImages.get(file)?.objectPath)
      .filter((path): path is string => path !== undefined);

    setFiles(nextFiles);
    setUploadedImages((images) => {
      const retainedImages = new Map(images);
      for (const file of removedFiles) {
        retainedImages.delete(file);
      }
      return retainedImages;
    });
    void removeUnusedImages(removedObjectPaths);
  }, [files, removeUnusedImages, uploadedImages]);

  function handleIncomingFiles(incomingFiles: File[]) {
    if (isUploading || isSubmitting || incomingFiles.length === 0) return;

    const validFiles: File[] = [];
    for (const file of incomingFiles) {
      if (files.length + validFiles.length >= MAX_FILES) {
        toast.error(`Maximum of ${MAX_FILES} photos allowed.`);
        continue;
      }
      if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
        toast.error(`${file.name}: This image format is not supported.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File exceeds 5MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    handleFilesChange([...files, ...validFiles]);
    void onUpload(validFiles, {
      onProgress: () => { },
      onSuccess: () => { },
      onError: () => { },
    });
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isUploading || isSubmitting) return;

    if (event.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setIsDraggingOver(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingOver(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    handleIncomingFiles(Array.from(event.dataTransfer.files));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();

    if (!currentUser) {
      toast.error("Choose a profile before posting.");
      return;
    }

    if (!text && files.length === 0) {
      toast.error("Write something or add a photo.");
      return;
    }

    if (files.some((file) => !uploadedImages.has(file))) {
      toast.error("Wait for each photo to finish uploading before sharing.");
      return;
    }

    if (
      files.some(
        (file) => uploadedImages.get(file)?.ownerId !== currentUser.id,
      )
    ) {
      toast.error("Remove and reattach photos after switching profiles.");
      return;
    }

    setIsSubmitting(true);
    try {
      const imageUrls = files
        .map((file) => uploadedImages.get(file)?.publicUrl)
        .filter((url): url is string => url !== undefined);
      if (imageUrls.length !== files.length) {
        toast.error("One or more photos could not be uploaded.");
        return;
      }

      const post = await createWallPost({
        user_id: currentUser.id,
        post: text || null,
        image: imageUrls,
        likes_by: [],
      });

      onPostCreated(post);
      setMessage("");
      setFiles([]);
      setUploadedImages(new Map());
      toast.success("Your post is on the wall.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not publish your post.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isMissingUploadedImage = files.some(
    (file) => !uploadedImages.has(file),
  );

  const canSubmit =
    !isSubmitting &&
    !isUploading &&
    !isMissingUploadedImage &&
    (Boolean(message.trim()) || files.length > 0);

  return (
    <FileUpload
      value={files}
      onValueChange={handleFilesChange}
      onUpload={onUpload}
      onFileReject={(file, reason) => toast.error(`${file.name}: ${reason}`)}
      accept={IMAGE_ACCEPT_ATTRIBUTE}
      maxFiles={MAX_FILES}
      maxSize={MAX_FILE_SIZE}
      multiple
      disabled={isUploading || isSubmitting}
    >
      <form
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-dragging={isDraggingOver ? "" : undefined}
        className="piecebook-card-surface relative flex max-h-[240px] shrink-0 flex-col overflow-hidden rounded-sm border shadow-none"
      >
        <div className="inline-flex items-center gap-4 piecebook-divider piecebook-muted-surface shrink-0 border-b px-4 py-1">
          <Avatar className="mt-1 size-9 shrink-0 md:hidden block">
            {currentUser && (
              <AvatarImage
                src={currentUser.image}
                alt={currentUser.full_name}
              />
            )}
            <AvatarFallback className="piecebook-avatar-fallback">
              {currentUser ? getInitials(currentUser.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <h2 className="piecebook-brand-text text-sm font-bold">
            Write on your wall
          </h2>
        </div>

        <div className="flex min-h-0 flex-1 gap-3 p-2 sm:p-3">


          <div
            className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-md border border-input bg-background px-3 py-1.5 outline-none focus-within:ring-1 focus-within:ring-ring/50"
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary/50 bg-background/85 p-4 backdrop-blur-xs transition-opacity duration-200 ${isDraggingOver ? "opacity-100" : "opacity-0"
                }`}
            >
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex items-center justify-center rounded-full border p-2.5">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Drag & drop photos here</p>
                <p className="text-xs text-muted-foreground">
                  Up to {MAX_FILES} photos, max 5MB each
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <FileUploadList
                orientation="horizontal"
                className="h-8 max-h-8 shrink-0 overflow-x-auto px-0 py-0 scrollbar-hide"
              >
                {files.map((file, index) => (
                  <FileUploadItem
                    key={`${file.name}-${file.lastModified}-${index}`}
                    value={file}
                    className="relative p-0 "
                  >
                    <FileUploadItemPreview className="size-8 [&>svg]:size-5">
                      <FileUploadItemProgress variant="fill" />
                    </FileUploadItemPreview>
                    <FileUploadItemMetadata className="sr-only" />
                    <FileUploadItemDelete
                      render={(props) => (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          aria-label={`Remove ${file.name}`}
                          className="absolute -top-1 -right-1 size-4 shrink-0 cursor-pointer rounded-full"
                          {...props}
                        >
                          <X className="size-2.5" />
                        </Button>
                      )}
                    />
                  </FileUploadItem>
                ))}
              </FileUploadList>
            )}

            <label className="sr-only" htmlFor="wall-post">
              Write a wall post
            </label>
            <Textarea
              id="wall-post"
              value={message}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onChange={(event) =>
                setMessage(event.target.value.slice(0, MAX_CHARS))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={MAX_CHARS}
              placeholder="What's on your mind?"
              className="field-sizing-fixed min-h-20 max-h-32 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm shadow-none scrollbar-hide focus-visible:ring-0 dark:bg-transparent"
              disabled={isUploading || isSubmitting}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground tabular-nums">
                {message.length}/{MAX_CHARS}
              </span>

              <div className="flex items-center gap-1.5">
                <FileUploadTrigger
                  render={(props) => (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      {...props}
                    >
                      <Paperclip className="size-3.5" />
                      <span className="sr-only">Attach photo</span>
                    </Button>
                  )}
                />


                <Button type="submit" disabled={!canSubmit} className="bg-primary hover:bg-primary/90" >
                  Share
                  {isSubmitting ?
                    <Loader2 data-icon="inline-end" className="size-3.5 animate-spin" /> : <Send data-icon="inline-end" className="size-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FileUpload>
  );
}
