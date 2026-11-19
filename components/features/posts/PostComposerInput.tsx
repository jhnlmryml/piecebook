"use client";

import type {
  DragEventHandler,
  FormEventHandler,
  FormHTMLAttributes,
  KeyboardEventHandler,
  ReactNode,
} from "react";
import { useState } from "react";
import { ImagePlusIcon, Loader2, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FileUpload,
  FileUploadDropzone,
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

type ComposerFileUploadOptions = {
  value: File[];
  onValueChange: (files: File[]) => void;
  accept: string;
  maxFiles: number;
  maxSize: number;
  multiple?: boolean;
  onUpload?: FileUploadProps["onUpload"];
  onFileReject?: FileUploadProps["onFileReject"];
  onFileValidate?: FileUploadProps["onFileValidate"];
  showProgress?: boolean;
  attachmentLabel?: string;
  dropzoneTitle?: string;
  dropzoneDescription?: string;
};

type PostComposerInputProps = {
  variant?: "post" | "comment";
  id: string;
  value: string;
  maxLength: number;
  placeholder: string;
  disabled: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  fileUpload?: ComposerFileUploadOptions;
  header?: ReactNode;
  overlay?: ReactNode;
  attachmentPreview?: ReactNode;
  attachmentAction?: ReactNode;
  formClassName?: string;
  contentClassName?: string;
  fieldClassName?: string;
  textareaClassName?: string;
  footerClassName?: string;
  actionsClassName?: string;
  submitButtonClassName?: string;
  submitButtonSize?: "default" | "icon" | "icon-lg";
  submitLabel?: string;
  submitAriaLabel?: string;
  showCharacterCount?: boolean;
  isDraggingOver?: boolean;
  textareaRows?: number;
  textareaKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  textareaDragOver?: DragEventHandler<HTMLTextAreaElement>;
  textareaDrop?: DragEventHandler<HTMLTextAreaElement>;
  formProps?: Omit<
    FormHTMLAttributes<HTMLFormElement>,
    "children" | "className" | "onSubmit"
  >;
};

const POST_FORM_CLASS =
  "piecebook-card-surface relative flex w-full min-w-0 max-h-60 shrink-0 flex-col overflow-hidden rounded-sm border shadow-none";
const POST_CONTENT_CLASS = "relative flex min-h-0 flex-1 gap-3 p-2 sm:p-3";
const POST_FIELD_CLASS =
  "relative flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-md border border-input bg-background px-3 py-1.5 outline-none focus-within:ring-1 focus-within:ring-ring/50";
const POST_TEXTAREA_CLASS =
  "field-sizing-fixed min-h-20 max-h-32 w-full flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm shadow-none scrollbar-hide select-text focus-visible:ring-0 dark:bg-transparent";
const COMMENT_FORM_CLASS =
  "piecebook-card-surface relative flex w-full min-w-0 flex-col overflow-visible rounded-2xl border p-1 shadow-sm transition-colors hover:border-primary/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15";
const COMMENT_CONTENT_CLASS = "relative flex min-w-0 flex-1 items-center";
const COMMENT_FIELD_CLASS =
  "relative flex min-h-0 min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-xl bg-muted/35 px-1.5 py-1";
const COMMENT_TEXTAREA_CLASS =
  "field-sizing-fixed h-10 min-h-10 max-h-10 w-full min-w-0 flex-1 resize-none overflow-x-hidden overflow-y-hidden whitespace-nowrap border-0 bg-transparent px-1 py-2 text-sm leading-6 shadow-none scrollbar-hide select-text focus-visible:ring-0 dark:bg-transparent";
const submitOnEnter: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

/** Shared composer layout, controls, file picker, preview, and dropzone. */
export function PostComposerInput({
  variant = "post",
  id,
  value,
  maxLength,
  placeholder,
  disabled,
  canSubmit,
  isSubmitting,
  onChange,
  onSubmit,
  fileUpload,
  header,
  overlay,
  attachmentPreview,
  attachmentAction,
  formClassName,
  contentClassName,
  fieldClassName,
  textareaClassName,
  footerClassName,
  actionsClassName,
  submitButtonClassName,
  submitButtonSize = "icon-lg",
  submitLabel,
  submitAriaLabel,
  showCharacterCount = false,
  isDraggingOver = false,
  textareaRows = 1,
  textareaKeyDown,
  textareaDragOver,
  textareaDrop,
  formProps,
}: PostComposerInputProps) {
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const resolvedFormClassName =
    formClassName ??
    (variant === "comment"
      ? COMMENT_FORM_CLASS
      : fileUpload
        ? POST_FORM_CLASS
        : "flex items-end gap-2");
  const resolvedContentClassName =
    contentClassName ??
    (variant === "comment"
      ? COMMENT_CONTENT_CLASS
      : fileUpload
        ? POST_CONTENT_CLASS
        : "min-w-0 flex-1");
  const resolvedFieldClassName =
    fieldClassName ??
    (variant === "comment"
      ? COMMENT_FIELD_CLASS
      : fileUpload
        ? POST_FIELD_CLASS
        : "min-w-0 flex-1 space-y-2");
  const resolvedTextareaClassName =
    textareaClassName ??
    (variant === "comment"
      ? COMMENT_TEXTAREA_CLASS
      : fileUpload
        ? POST_TEXTAREA_CLASS
        : "min-h-10 max-h-28 resize-y rounded-sm bg-background text-sm");
  const resolvedFooterClassName =
    footerClassName ??
    (variant === "comment"
      ? "flex shrink-0 items-center justify-end"
      : "flex items-center justify-between pt-1");
  const resolvedActionsClassName =
    actionsClassName ??
    (variant === "comment"
      ? "flex items-center gap-1"
      : fileUpload
        ? "flex items-center gap-1.5"
        : "flex items-center gap-2");
  const resolvedSubmitButtonClassName =
    submitButtonClassName ??
    (variant === "comment"
      ? "size-8 rounded-full bg-primary shadow-sm hover:bg-primary/90 [&_svg]:size-3.5"
      : fileUpload
        ? "bg-primary hover:bg-primary/90 [&_svg]:size-3.5"
        : undefined);
  const resolvedTextareaKeyDown =
    textareaKeyDown ?? (fileUpload ? submitOnEnter : undefined);
  const handleDropzoneDragEnter: DragEventHandler<HTMLDivElement> = (event) => {
    if (event.dataTransfer.types.includes("Files")) {
      setIsFileDragActive(true);
    }
  };
  const handleDropzoneDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    if (event.dataTransfer.types.includes("Files")) {
      setIsFileDragActive(true);
    }
  };
  const handleDropzoneDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    setIsFileDragActive(false);
  };
  const handleDropzoneDrop: DragEventHandler<HTMLDivElement> = () => {
    setIsFileDragActive(false);
  };

  const form = (
    <form
      className={resolvedFormClassName}
      onSubmit={onSubmit}
      data-dragging={isDraggingOver ? "" : undefined}
      {...formProps}
    >
      {header}
      <div className={resolvedContentClassName}>
        {fileUpload && (
          variant === "comment" ? (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-1 z-20 rounded-2xl border-2 border-dashed border-primary/70 transition-opacity duration-200 ${isFileDragActive ? "opacity-100" : "opacity-0"}`}
            >
              <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/30 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                <Upload className="size-3.5 text-primary" />
                {fileUpload.dropzoneTitle ?? "Drop images to attach"}
              </div>
            </div>
          ) : (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-sm border-2 border-dashed border-primary/50 bg-background/85 p-4 backdrop-blur-xs transition-opacity duration-200 ${isFileDragActive ? "opacity-100" : "opacity-0"}`}
            >
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex items-center justify-center rounded-full border p-2.5">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">
                  {fileUpload.dropzoneTitle ?? "Drag & drop photos here"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fileUpload.dropzoneDescription ??
                    `Up to ${fileUpload.maxFiles} photos, max 5MB each`}
                </p>
              </div>
            </div>
          )
        )}
        <div className={resolvedFieldClassName}>
          {overlay}
          {fileUpload && fileUpload.value.length > 0 ? (
            <FileUploadList
              orientation="horizontal"
              className={`h-8 max-h-8 shrink-0 overflow-x-auto px-0 py-0 scrollbar-hide ${variant === "comment" ? "max-w-[34%]" : ""}`}
            >
              {fileUpload.value.map((file, index) => (
                <FileUploadItem
                  key={`${file.name}-${file.lastModified}-${index}`}
                  value={file}
                  className="relative p-0"
                >
                  <FileUploadItemPreview className="size-8 [&>svg]:size-5">
                    {fileUpload.showProgress && (
                      <FileUploadItemProgress variant="fill" />
                    )}
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
          ) : (
            attachmentPreview
          )}
          <label className="sr-only" htmlFor={id}>
            {placeholder}
          </label>
          <Textarea
            id={id}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value.slice(0, maxLength);
              onChange(
                variant === "comment"
                  ? nextValue.replace(/[\r\n]+/g, " ")
                  : nextValue,
              );
            }}
            onKeyDown={resolvedTextareaKeyDown}
            onDragOver={textareaDragOver}
            onDrop={textareaDrop}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={textareaRows}
            disabled={disabled}
            className={resolvedTextareaClassName}
          />
          <div className={resolvedFooterClassName}>
            {showCharacterCount ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {value.length}/{maxLength}
              </span>
            ) : (
              <span />
            )}
            <div className={resolvedActionsClassName}>
              {fileUpload ? (
                <FileUploadTrigger
                  render={(props) => (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={fileUpload.attachmentLabel ?? "Attach photo"}
                      className={variant === "comment" ? "size-8 rounded-full" : "size-7"}
                      {...props}
                    >
                      <ImagePlusIcon className="size-3.5" />
                      <span className="sr-only">
                        {fileUpload.attachmentLabel ?? "Attach photo"}
                      </span>
                    </Button>
                  )}
                />
              ) : (
                attachmentAction
              )}
              <Button
                type="submit"
                size={submitButtonSize}
                aria-label={submitLabel ? undefined : submitAriaLabel}
                disabled={!canSubmit}
                className={resolvedSubmitButtonClassName}
              >
                {submitLabel}
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {!submitLabel && submitAriaLabel && (
                  <span className="sr-only">{submitAriaLabel}</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );

  if (!fileUpload) return form;

  return (
    <FileUpload
      className="w-full min-w-0"
      value={fileUpload.value}
      onValueChange={fileUpload.onValueChange}
      onUpload={fileUpload.onUpload}
      onFileReject={fileUpload.onFileReject}
      onFileValidate={fileUpload.onFileValidate}
      accept={fileUpload.accept}
      maxFiles={fileUpload.maxFiles}
      maxSize={fileUpload.maxSize}
      multiple={fileUpload.multiple}
      disabled={disabled}
    >
      <FileUploadDropzone
        clickToSelect={false}
        onDragEnter={handleDropzoneDragEnter}
        onDragOver={handleDropzoneDragOver}
        onDragLeave={handleDropzoneDragLeave}
        onDrop={handleDropzoneDrop}
        className="group relative w-full min-w-0 items-stretch justify-start border-0 p-0 hover:bg-transparent data-[dragging]:border-0 data-[dragging]:bg-transparent"
      >
        {form}
      </FileUploadDropzone>
    </FileUpload>
  );
}
