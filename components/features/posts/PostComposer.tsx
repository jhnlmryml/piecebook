"use client";

import {
  useCallback,
  useState,
  type SubmitEvent,
} from "react";
import { toast } from "sonner";
import {
  imageFileSchema,
  postDraftSchema,
  POST_MAX_LENGTH,
  IMAGE_MAX_COUNT,
  IMAGE_MAX_SIZE,
} from "@/lib/form-schemas";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FileUploadProps } from "@/components/ui/file-upload";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { PostComposerInput } from "@/components/features/posts/PostComposerInput";
import {
  createWallPost,
  removePostImages,
  uploadPostImage,
  type WallPost,
} from "@/lib/posts";

const MAX_CHARS = POST_MAX_LENGTH;
const MAX_FILES = IMAGE_MAX_COUNT;
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
      const pathsByProfile = new Map<string, string[]>();
      for (const path of objectPaths) {
        const ownerId = path.split("/")[0];
        if (!ownerId) continue;
        const paths = pathsByProfile.get(ownerId) ?? [];
        paths.push(path);
        pathsByProfile.set(ownerId, paths);
      }
      await Promise.all(
        [...pathsByProfile].map(([ownerId, paths]) =>
          removePostImages(ownerId, paths),
        ),
      );
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
      await Promise.all(
        uploadFiles.map(async (file) => {
          try {
            const uploaded = await uploadPostImage(file, currentUser.id);
            setUploadedImages((images) =>
              new Map(images).set(file, {
                profileId: currentUser.id,
                objectPath: uploaded.path,
                publicUrl: uploaded.url,
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

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = postDraftSchema.safeParse({
      body: message,
      imageFiles: files,
    });
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Check your post and try again.",
      );
      return;
    }
    const text = validation.data.body;

    if (!currentUser) {
      toast.error("Choose a profile before posting.");
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
          const validation = imageFileSchema.safeParse(file);
          return validation.success
            ? null
            : validation.error.issues[0]?.message ?? "Choose a valid image.";
        },
        accept: IMAGE_ACCEPT_ATTRIBUTE,
        maxFiles: MAX_FILES,
        maxSize: IMAGE_MAX_SIZE,
        multiple: true,
        showProgress: true,
        attachmentLabel: "Attach photo",
        dropzoneTitle: "Drag & drop photos here",
        dropzoneDescription: `Up to ${MAX_FILES} photos, max ${IMAGE_MAX_SIZE / 1024 / 1024} MB each`,
      }}
      header={
        <div className="flex shrink-0 items-center gap-3 px-3 pt-2">
          <Avatar className="size-9 shrink-0">
            {currentUser?.image && (
              <AvatarImage src={currentUser.image} alt={currentUser.full_name} />
            )}
            <AvatarFallback className="piecebook-avatar-fallback">
              {currentUser ? getInitials(currentUser.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-sm font-semibold text-foreground">
            Write on your wall
          </h2>
        </div>
      }
      submitButtonSize="icon-lg"
      submitButtonClassName="size-10 rounded-full bg-primary shadow-sm hover:bg-primary/90 [&_svg]:size-4"
      submitAriaLabel="Share post"
      showCharacterCount
    />
  );
}
