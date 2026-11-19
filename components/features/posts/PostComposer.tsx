"use client";

import {
  useCallback,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FileUploadProps } from "@/components/ui/file-upload";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { PostComposerInput } from "@/components/features/posts/PostComposerInput";
import {
  createWallPost,
  POST_IMAGE_BUCKET,
  type WallPost,
} from "@/lib/posts";
import { getSupabaseClient } from "@/lib/supabase";

const MAX_CHARS = 280;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_ACCEPT_ATTRIBUTE = "image/*";

type PostComposerProps = {
  onPostCreated: (post: WallPost) => void;
};

type UploadedImage = {
  profileId: string;
  objectPath: string;
  publicUrl: string;
};

type UploadedImageMap = Map<File, UploadedImage>;

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { currentUser } = useProfile();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageMap>(
    () => new Map(),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.error("Choose a profile before posting.");
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
                profileId: currentUser.id,
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
        (file) => uploadedImages.get(file)?.profileId !== currentUser.id,
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
    <PostComposerInput
      id="wall-post"
      value={message}
      maxLength={MAX_CHARS}
      placeholder="What's on your mind?"
      disabled={isUploading || isSubmitting}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      onChange={setMessage}
      onSubmit={handleSubmit}
      fileUpload={{
        value: files,
        onValueChange: handleFilesChange,
        onUpload,
        onFileReject: (file, reason) => toast.error(`${file.name}: ${reason}`),
        onFileValidate: (file) => {
          if (!file.type.toLowerCase().startsWith("image/")) {
            return "Choose an image file to upload.";
          }
          if (file.size > MAX_FILE_SIZE) {
            return "File exceeds 5MB limit.";
          }
          return null;
        },
        accept: IMAGE_ACCEPT_ATTRIBUTE,
        maxFiles: MAX_FILES,
        maxSize: MAX_FILE_SIZE,
        multiple: true,
        showProgress: true,
        attachmentLabel: "Attach photo",
        dropzoneTitle: "Drag & drop photos here",
        dropzoneDescription: `Up to ${MAX_FILES} photos, max 5MB each`,
      }}
      header={
        <div className="inline-flex shrink-0 items-center gap-4 piecebook-divider piecebook-muted-surface border-b px-4 py-1">
          <Avatar className="mt-1 block size-9 shrink-0 md:hidden">
            {currentUser?.image && (
              <AvatarImage src={currentUser.image} alt={currentUser.full_name} />
            )}
            <AvatarFallback className="piecebook-avatar-fallback">
              {currentUser ? getInitials(currentUser.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <h2 className="piecebook-brand-text text-sm font-bold">
            Write on your wall
          </h2>
        </div>
      }
      submitButtonSize="default"
      submitButtonClassName="bg-primary hover:bg-primary/90 [&_svg]:size-3.5"
      submitLabel="Share"
      showCharacterCount
    />
  );
}
