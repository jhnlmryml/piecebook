"use client";

import { ArrowUp, Paperclip, Upload, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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
    type FileUploadProps,
    FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 280;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function TextField() {
    const [input, setInput] = React.useState("");
    const [files, setFiles] = React.useState<File[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const dragCounterRef = React.useRef(0);

    const onInputChange = React.useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            setInput(event.target.value.slice(0, MAX_CHARS));
        },
        [],
    );

    const onUpload: NonNullable<FileUploadProps["onUpload"]> = React.useCallback(
        async (uploadFiles, { onProgress, onSuccess, onError }) => {
            setIsUploading(true);
            try {
                await Promise.all(
                    uploadFiles.map(async (file) => {
                        try {
                            const totalChunks = 10;
                            let uploadedChunks = 0;

                            for (let i = 0; i < totalChunks; i++) {
                                await new Promise((resolve) =>
                                    setTimeout(resolve, Math.random() * 200 + 100),
                                );
                                uploadedChunks++;
                                const progress = (uploadedChunks / totalChunks) * 100;
                                onProgress(file, progress);
                            }

                            await new Promise((resolve) => setTimeout(resolve, 500));
                            onSuccess(file);
                        } catch (error) {
                            onError(
                                file,
                                error instanceof Error ? error : new Error("Upload failed"),
                            );
                        }
                    }),
                );
            } catch (error) {
                console.error("Unexpected error during upload:", error);
            } finally {
                setIsUploading(false);
            }
        },
        [],
    );

    const onFileReject = React.useCallback((file: File, message: string) => {
        toast(message, {
            description: `"${
                file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name
            }" has been rejected`,
        });
    }, []);

    // Adds dropped files while respecting MAX_FILES and MAX_FILE_SIZE
    const handleIncomingFiles = React.useCallback(
        (incoming: File[]) => {
            if (isUploading || incoming.length === 0) return;

            const validFiles: File[] = [];
            for (const file of incoming) {
                if (files.length + validFiles.length >= MAX_FILES) {
                    onFileReject(file, `Maximum ${MAX_FILES} files allowed`);
                    continue;
                }
                if (file.size > MAX_FILE_SIZE) {
                    onFileReject(file, "File exceeds 5MB limit");
                    continue;
                }
                validFiles.push(file);
            }

            if (validFiles.length > 0) {
                const nextFiles = [...files, ...validFiles];
                setFiles(nextFiles);
                void onUpload(validFiles, {
                    onProgress: () => {},
                    onSuccess: () => {},
                    onError: (file, err) => onFileReject(file, err.message),
                });
            }
        },
        [files, isUploading, onFileReject, onUpload],
    );

    const handleDragEnter = React.useCallback(
        (e: React.DragEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            if (isUploading) return;
            if (e.dataTransfer?.types?.includes("Files")) {
                dragCounterRef.current += 1;
                setIsDraggingOver(true);
            }
        },
        [isUploading],
    );

    const handleDragOver = React.useCallback((e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
        }
    }, []);

    const handleDragLeave = React.useCallback(
        (e: React.DragEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
            if (dragCounterRef.current === 0) {
                setIsDraggingOver(false);
            }
        },
        [],
    );

    const handleDrop = React.useCallback(
        (e: React.DragEvent<HTMLFormElement>) => {
            // Crucial: prevents browser/textarea from inserting the filename as text
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = 0;
            setIsDraggingOver(false);

            const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
            if (droppedFiles.length > 0) {
                handleIncomingFiles(droppedFiles);
            }
        },
        [handleIncomingFiles],
    );

    // Extra safeguard directly on the textarea so dropping on it never pastes a filename
    const handleTextareaDrop = React.useCallback(
        (e: React.DragEvent<HTMLTextAreaElement>) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = 0;
            setIsDraggingOver(false);

            const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
            if (droppedFiles.length > 0) {
                handleIncomingFiles(droppedFiles);
            }
        },
        [handleIncomingFiles],
    );

    const onSubmit = React.useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!input.trim() && files.length === 0) return;

            // Handle post submission here
            setInput("");
            setFiles([]);
        },
        [input, files.length],
    );

    const canSubmit = (input.trim().length > 0 || files.length > 0) && !isUploading;

    return (
        <FileUpload
            value={files}
            onValueChange={setFiles}
            onUpload={onUpload}
            onFileReject={onFileReject}
            maxFiles={MAX_FILES}
            maxSize={MAX_FILE_SIZE}
            className="w-full max-h-50 p-2 mt-2 "
            multiple
            disabled={isUploading}
        >
            <form
                onSubmit={onSubmit}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-dragging={isDraggingOver ? "" : undefined}
                className="relative flex w-full flex-col gap-2.5 overflow-hidden rounded-md border border-input bg-background px-3 py-2 outline-none focus-within:ring-1 focus-within:ring-ring/50"
            >
                <FileUploadDropzone
                    tabIndex={-1}
                    onClick={(event) => event.preventDefault()}
                    className={`absolute inset-0 z-10 flex size-full items-center justify-center rounded-md border-2 border-dashed border-primary/50 bg-background/85 p-4 backdrop-blur-xs transition-opacity duration-200 ease-out ${
                        isDraggingOver
                            ? "pointer-events-auto opacity-100"
                            : "pointer-events-none opacity-0"
                    }`}
                >
                    <div className="flex flex-col items-center gap-1 text-center">
                        <div className="flex items-center justify-center rounded-full border p-2.5">
                            <Upload className="size-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">Drag & drop files here</p>
                        <p className="text-xs text-muted-foreground">
                            Up to {MAX_FILES} files, max 5MB each
                        </p>
                    </div>
                </FileUploadDropzone>

                {files.length > 0 && (
                    <FileUploadList
                        orientation="horizontal"
                        className="overflow-x-auto px-0 py-1"
                    >
                        {files.map((file, index) => (
                            <FileUploadItem
                                key={`${file.name}-${index}`}
                                value={file}
                                className="max-w-52 p-1.5"
                            >
                                <FileUploadItemPreview className="size-8 [&>svg]:size-5">
                                    <FileUploadItemProgress variant="fill" />
                                </FileUploadItemPreview>
                                <FileUploadItemMetadata size="sm" />
                                <FileUploadItemDelete
                                    render={(props) => (
                                        <Button
                                            variant="secondary"
                                            size="icon"
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

                <Textarea
                    value={input}
                    onChange={onInputChange}
                    onDragOver={(e) => {
                        e.preventDefault();
                    }}
                    onDrop={handleTextareaDrop}
                    maxLength={MAX_CHARS}
                    placeholder="What's on your mind?"
                    className="overflow-auto no-scrollbar field-sizing-content min-h-14 w-full resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                    disabled={isUploading}
                />

                <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {input.length}/{MAX_CHARS}
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
                                    <span className="sr-only">Attach file</span>
                                </Button>
                            )}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="size-7"
                            disabled={!canSubmit}
                        >
                            <ArrowUp className="size-3.5" />
                            <span className="sr-only">Post</span>
                        </Button>
                    </div>
                </div>
            </form>
        </FileUpload>
    );
}