"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import Image from "next/image";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  profileFieldsSchema,
  profileImageFileSchema,
} from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/context/ProfileContext";
import {
  getOwnedProfileImagePath,
  PROFILE_IMAGE_MAX_SIZE,
  removeProfileImage,
  uploadProfileImage,
} from "@/lib/profile-images";
import { saveUserProfile, type UserProfileFields } from "@/lib/user-profiles";
import type { UserProfile } from "@/types/user-profile";

type ProfileFieldName = keyof UserProfileFields;
type ValidationErrors = Partial<Record<ProfileFieldName | "imageFile", string>>;

function profileFieldsFromUser(user: UserProfile): UserProfileFields {
  return {
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    birthdate: user.birthdate,
    location: user.location,
    interests: user.interests,
    dream: user.dream,
    about: user.about,
    image: user.image,
  };
}

export function ProfileEditDialog({ user }: { user: UserProfile }) {
  const { currentUser, updateProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => profileFieldsFromUser(user));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    },
    [],
  );

  function clearPreview() {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    imagePreviewRef.current = null;
    setImagePreview(null);
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) return;
    if (nextOpen) {
      setDraft(profileFieldsFromUser(user));
      setErrors({});
      clearPreview();
    } else {
      clearPreview();
      setDraft(profileFieldsFromUser(user));
      setErrors({});
    }
    setOpen(nextOpen);
  }

  function updateDraft<K extends ProfileFieldName>(field: K, value: UserProfileFields[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleImageChange(file?: File) {
    if (!file) return;
    const validation = profileImageFileSchema.safeParse(file);
    if (!validation.success) {
      setErrors((current) => ({
        ...current,
        imageFile:
          validation.error.issues[0]?.message ?? "Choose a valid image file.",
      }));
      return;
    }

    clearPreview();
    const preview = URL.createObjectURL(file);
    imagePreviewRef.current = preview;
    setImageFile(file);
    setImagePreview(preview);
    setErrors((current) => ({ ...current, imageFile: undefined }));
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = profileFieldsSchema.safeParse(draft);
    const validationErrors: ValidationErrors = {};
    if (!validation.success) {
      const profileFields: ProfileFieldName[] = [
        "full_name",
        "email",
        "role",
        "birthdate",
        "location",
        "interests",
        "dream",
        "about",
        "image",
      ];
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (
          typeof field === "string" &&
          profileFields.includes(field as ProfileFieldName)
        ) {
          validationErrors[field as ProfileFieldName] ??= issue.message;
        }
      }
    }
    if (errors.imageFile) validationErrors.imageFile = errors.imageFile;
    setErrors(validationErrors);
    if (!validation.success || errors.imageFile) return;

    if (currentUser?.id !== user.id || isSaving) {
      toast.error("Select this profile before editing it.");
      return;
    }

    setIsSaving(true);
    let uploadedImagePath: string | null = null;
    try {
      let image = draft.image;
      if (imageFile) {
        const uploaded = await uploadProfileImage(imageFile, user.id);
        uploadedImagePath = uploaded.path;
        image = uploaded.url;
      }

      const updatedProfile = await saveUserProfile({
        profileId: user.id,
        fields: {
          ...validation.data,
          interests: validation.data.interests.filter(Boolean),
          image,
        },
      });

      updateProfile(updatedProfile);
      const previousImagePath = getOwnedProfileImagePath(user.image, user.id);
      if (previousImagePath && previousImagePath !== uploadedImagePath) {
        await removeProfileImage(previousImagePath).catch(() => undefined);
      }
      toast.success("Profile updated.");
      clearPreview();
      setOpen(false);
    } catch (error) {
      if (uploadedImagePath) {
        await removeProfileImage(uploadedImagePath).catch(() => undefined);
      }
      toast.error(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  const visibleImage = imagePreview ?? draft.image;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="w-full rounded-sm">
            Edit profile
          </Button>
        }
      />
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-sm sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update the information and profile photo shown to other Piecebook members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {currentUser?.id !== user.id && (
            <p role="status" className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
              Switch to this profile before saving changes.
            </p>
          )}

          <Field data-invalid={Boolean(errors.imageFile)}>
            <div className="flex flex-wrap items-center gap-4 rounded-sm border border-border p-3">
              <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {visibleImage ? (
                  <Image
                    src={visibleImage}
                    alt="Profile photo preview"
                    width={80}
                    height={80}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{draft.full_name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <FieldLabel htmlFor="profile-image">Profile photo</FieldLabel>
                <Input
                  ref={imageInputRef}
                  id="profile-image"
                  type="file"
                  accept="image/*"
                  disabled={isSaving}
                  aria-invalid={Boolean(errors.imageFile)}
                  onChange={(event) => {
                    handleImageChange(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <FieldDescription>
                  Any image format, up to {PROFILE_IMAGE_MAX_SIZE / 1024 / 1024} MB.
                </FieldDescription>
                <FieldError>{errors.imageFile}</FieldError>
                {(imagePreview || draft.image) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => {
                      clearPreview();
                      setDraft((current) => ({ ...current, image: "" }));
                      setErrors((current) => ({ ...current, imageFile: undefined }));
                    }}
                    className="h-7 rounded-sm px-2 text-xs text-destructive"
                  >
                    <X className="size-3.5" />
                    Remove photo
                  </Button>
                )}
              </div>
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.full_name)} className="sm:col-span-2">
              <FieldLabel htmlFor="profile-full-name">Name</FieldLabel>
              <Input
                id="profile-full-name"
                value={draft.full_name}
                maxLength={80}
                disabled={isSaving}
                aria-invalid={Boolean(errors.full_name)}
                onChange={(event) => updateDraft("full_name", event.target.value)}
              />
              <FieldError>{errors.full_name}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.role)}>
              <FieldLabel htmlFor="profile-role">Role</FieldLabel>
              <Input id="profile-role" maxLength={80} value={draft.role} disabled={isSaving} aria-invalid={Boolean(errors.role)} onChange={(event) => updateDraft("role", event.target.value)} />
              <FieldError>{errors.role}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.birthdate)}>
              <FieldLabel htmlFor="profile-birthdate">Birthday</FieldLabel>
              <Input id="profile-birthdate" type="date" value={draft.birthdate} disabled={isSaving} aria-invalid={Boolean(errors.birthdate)} onChange={(event) => updateDraft("birthdate", event.target.value)} />
              <FieldError>{errors.birthdate}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.location)} className="sm:col-span-2">
              <FieldLabel htmlFor="profile-location">Location</FieldLabel>
              <Input id="profile-location" maxLength={120} value={draft.location} disabled={isSaving} aria-invalid={Boolean(errors.location)} onChange={(event) => updateDraft("location", event.target.value)} />
              <FieldError>{errors.location}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.interests)} className="sm:col-span-2">
              <FieldLabel htmlFor="profile-interests">Interests</FieldLabel>
              <Input
                id="profile-interests"
                maxLength={400}
                value={draft.interests.join(", ")}
                disabled={isSaving}
                aria-invalid={Boolean(errors.interests)}
                onChange={(event) => updateDraft("interests", event.target.value.split(","))}
                placeholder="Photography, music, hiking"
              />
              <FieldDescription>Separate interests with commas.</FieldDescription>
              <FieldError>{errors.interests}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.dream)} className="sm:col-span-2">
              <FieldLabel htmlFor="profile-dream">A goal or dream</FieldLabel>
              <Input id="profile-dream" maxLength={240} value={draft.dream} disabled={isSaving} aria-invalid={Boolean(errors.dream)} onChange={(event) => updateDraft("dream", event.target.value)} />
              <FieldError>{errors.dream}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.about)} className="sm:col-span-2">
              <FieldLabel htmlFor="profile-about">About</FieldLabel>
              <Textarea
                id="profile-about"
                rows={4}
                maxLength={1200}
                value={draft.about}
                disabled={isSaving}
                aria-invalid={Boolean(errors.about)}
                onChange={(event) => updateDraft("about", event.target.value)}
                className="min-h-24 resize-y rounded-sm text-sm"
              />
              <FieldDescription className="text-right">{draft.about.length}/1200</FieldDescription>
              <FieldError>{errors.about}</FieldError>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => handleOpenChange(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || currentUser?.id !== user.id} className="rounded-sm">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
