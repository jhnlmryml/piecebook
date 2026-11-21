import { z } from "zod";

export const POST_MAX_LENGTH = 280;
export const COMMENT_MAX_LENGTH = 2000;
export const IMAGE_MAX_COUNT = 5;
export const MARKETPLACE_IMAGE_MAX_COUNT = 10;
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const MESSAGE_MAX_LENGTH = 1000;
export const MESSAGE_ATTACHMENT_MAX_COUNT = 5;
export const MESSAGE_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;

const fileMetadataSchema = z.object({
  name: z.string().max(255).optional(),
  type: z.string().max(255),
  size: z.number().int().nonnegative(),
});

export const imageFileSchema = fileMetadataSchema.superRefine((file, context) => {
  if (!file.type.toLowerCase().startsWith("image/")) {
    context.addIssue({ code: "custom", message: "Choose an image file." });
  }
  if (file.size > IMAGE_MAX_SIZE) {
    context.addIssue({
      code: "custom",
      message: `Images must be ${IMAGE_MAX_SIZE / 1024 / 1024} MB or smaller.`,
    });
  }
});

function imageFilesSchema(maxCount: number) {
  return z
    .array(imageFileSchema)
    .max(maxCount, `Attach no more than ${maxCount} images.`);
}

export const commentDraftSchema = z
  .object({
    body: z.string().trim().max(COMMENT_MAX_LENGTH),
    imageFiles: imageFilesSchema(IMAGE_MAX_COUNT),
  })
  .superRefine(({ body, imageFiles }, context) => {
    if (!body && imageFiles.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Write a comment or attach an image.",
        path: ["body"],
      });
    }
  });

export const commentPayloadSchema = z
  .object({
    body: z.string().trim().max(COMMENT_MAX_LENGTH),
    image: z.array(z.string().url()).max(IMAGE_MAX_COUNT).nullable(),
  })
  .superRefine(({ body, image }, context) => {
    if (!body && (!image || image.length === 0)) {
      context.addIssue({
        code: "custom",
        message: "Write a comment or attach an image.",
        path: ["body"],
      });
    }
  });

export const postDraftSchema = z
  .object({
    body: z.string().trim().max(POST_MAX_LENGTH),
    imageFiles: imageFilesSchema(IMAGE_MAX_COUNT),
  })
  .superRefine(({ body, imageFiles }, context) => {
    if (!body && imageFiles.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Write something or add a photo.",
        path: ["body"],
      });
    }
  });

export const wallPostPayloadSchema = z
  .object({
    user_id: z.string().uuid(),
    post: z.string().trim().max(POST_MAX_LENGTH).nullable(),
    image: z.array(z.string().url()).max(IMAGE_MAX_COUNT),
    likes_by: z.array(z.string().uuid()).max(1000),
  })
  .superRefine(({ post, image }, context) => {
    if (!post && image.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Write something or add a photo.",
        path: ["post"],
      });
    }
  });

function isValidBirthdate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const profileFieldsSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your name.").max(80),
    email: z
      .string()
      .trim()
      .max(254)
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
        message: "Enter a valid email address.",
      }),
    role: z.string().trim().max(80),
    birthdate: z.string().trim().refine(isValidBirthdate, {
      message: "Choose a valid date.",
    }),
    location: z.string().trim().max(120),
    interests: z.array(z.string().trim().max(100)).max(20),
    dream: z.string().trim().max(240),
    about: z.string().trim().max(1200),
    image: z.string().max(2048),
  })
  .superRefine(({ interests }, context) => {
    if (interests.join(", ").length > 400) {
      context.addIssue({
        code: "custom",
        message: "Keep interests under 400 characters.",
        path: ["interests"],
      });
    }
  });

export const profileImageFileSchema = fileMetadataSchema.superRefine(
  (file, context) => {
    if (!file.type.toLowerCase().startsWith("image/")) {
      context.addIssue({
        code: "custom",
        message: "Choose a valid image file.",
      });
    }
    if (file.size > IMAGE_MAX_SIZE) {
      context.addIssue({
        code: "custom",
        message: `Choose an image that is ${IMAGE_MAX_SIZE / 1024 / 1024} MB or smaller.`,
      });
    }
  },
);

const MESSAGE_ATTACHMENT_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "heic",
  "heif",
  "bmp",
  "svg",
  "pdf",
  "txt",
  "csv",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
]);

export const messageAttachmentFileSchema = fileMetadataSchema.superRefine(
  (file, context) => {
    const extension = file.name?.split(".").pop()?.toLowerCase() ?? "";
    if (
      !file.type.toLowerCase().startsWith("image/") &&
      !MESSAGE_ATTACHMENT_EXTENSIONS.has(extension)
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose an image, PDF, text, spreadsheet, presentation, or ZIP file.",
      });
    }
    if (file.size > MESSAGE_ATTACHMENT_MAX_SIZE) {
      context.addIssue({
        code: "custom",
        message: `Attachments must be ${MESSAGE_ATTACHMENT_MAX_SIZE / 1024 / 1024} MB or smaller.`,
      });
    }
  },
);

export const messageDraftSchema = z
  .object({
    body: z.string().trim().max(MESSAGE_MAX_LENGTH),
    files: z
      .array(messageAttachmentFileSchema)
      .max(
        MESSAGE_ATTACHMENT_MAX_COUNT,
        `You can attach up to ${MESSAGE_ATTACHMENT_MAX_COUNT} files per message.`,
      ),
  })
  .superRefine(({ body, files }, context) => {
    if (!body && files.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Write a message or attach a file.",
        path: ["body"],
      });
    }
  });

export const messageEditSchema = z
  .string()
  .trim()
  .min(1, "Write a message before saving it.")
  .max(MESSAGE_MAX_LENGTH, `Messages must be ${MESSAGE_MAX_LENGTH} characters or fewer.`);

export const marketplaceEmailSchema = z
  .string()
  .trim()
  .max(254)
  .email("Enter a valid email address.");

export const optionalMarketplaceEmailSchema = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? undefined : value,
  marketplaceEmailSchema.optional(),
);

export const checkoutRequestSchema = z.object({
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  quantity: z.number().int().positive(),
  buyerEmail: optionalMarketplaceEmailSchema,
});

export const checkoutFormSchema = checkoutRequestSchema.extend({
  availableQuantity: z.number().int().positive(),
}).superRefine(({ quantity, availableQuantity }, context) => {
  if (quantity > availableQuantity) {
    context.addIssue({
      code: "custom",
      message: "Enter a whole-number quantity within the available stock.",
      path: ["quantity"],
    });
  }
});
