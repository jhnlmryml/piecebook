import { z } from "zod";
import {
  MARKETPLACE_IMAGE_MAX_COUNT,
  imageFileSchema,
} from "@/lib/form-schemas";

export type Category =
  | "Vehicles"
  | "Property Rentals"
  | "Apparel"
  | "Classifieds"
  | "Electronics"
  | "Entertainment"
  | "Family"
  | "Free Stuff"
  | "Garden & Outdoor"
  | "Hobbies"
  | "Home Goods"
  | "Home Improvement Supplies"
  | "Home Sales"
  | "Musical Instruments"
  | "Office Supplies"
  | "Pet Supplies"
  | "Sporting Goods"
  | "Toys & Games";

export type ListingStatus = "available" | "pending" | "sold";

export const categoryDetailFields: Record<Category, string[]> = {
  Vehicles: ["Make", "Model", "Year", "Mileage", "Color"],
  "Property Rentals": ["Bedrooms", "Bathrooms", "Square feet", "Lease term"],
  Apparel: ["Brand", "Size", "Color", "Material"],
  Classifieds: ["Brand", "Color", "Material"],
  Electronics: ["Brand", "Model", "Storage", "Color"],
  Entertainment: ["Type", "Brand", "Color"],
  Family: ["Age range", "Brand", "Color"],
  "Free Stuff": ["Color", "Material"],
  "Garden & Outdoor": ["Brand", "Material", "Dimensions"],
  Hobbies: ["Brand", "Model", "Material"],
  "Home Goods": ["Brand", "Material", "Dimensions", "Color"],
  "Home Improvement Supplies": ["Brand", "Material", "Quantity"],
  "Home Sales": ["Bedrooms", "Bathrooms", "Square feet", "Year built"],
  "Musical Instruments": ["Brand", "Instrument type", "Color", "Material"],
  "Office Supplies": ["Brand", "Model", "Quantity"],
  "Pet Supplies": ["Pet type", "Brand", "Size"],
  "Sporting Goods": ["Brand", "Sport type", "Size", "Color"],
  "Toys & Games": ["Brand", "Age range", "Material"],
};

export const marketplaceCategories = Object.keys(categoryDetailFields) as Category[];
export const marketplaceConditions = [
  "New",
  "Used - like new",
  "Used - good",
  "Used - fair",
] as const;
export const MARKETPLACE_IMAGE_BUCKET = "marketplace-listing-images";

const categorySchema = z.string().refine(
  (value): value is Category => marketplaceCategories.includes(value as Category),
  "Choose a valid category.",
);
const conditionSchema = z.enum(marketplaceConditions);
const listingStatusSchema = z.enum(["available", "pending", "sold"]);
const listingPriceSchema = z.number().finite().min(0).max(9_999_999_999.99);
const listingQuantitySchema = z.number().int().min(0).max(2_147_483_647);
const listingCategoryDetailsSchema = z.record(
  z.string(),
  z.string().trim().max(200),
);

function validateCategoryDetails(
  value: { category: Category; categoryDetails: Record<string, string> },
  context: z.RefinementCtx,
) {
  const validFields = categoryDetailFields[value.category];
  for (const [field, detail] of Object.entries(value.categoryDetails)) {
    if (!validFields.includes(field)) {
      context.addIssue({
        code: "custom",
        message: "Remove details that do not match the selected category.",
        path: ["categoryDetails", field],
      });
    } else if (detail.trim().length > 200) {
      context.addIssue({
        code: "custom",
        message: "Use 200 characters or fewer.",
        path: ["categoryDetails", field],
      });
    }
  }
}

const listingTextFields = {
  title: z.string().trim().min(1, "Enter a title.").max(80),
  location: z.string().trim().min(1, "Enter a pickup location.").max(120),
  category: categorySchema,
  condition: conditionSchema,
  description: z.string().trim().max(5000),
  categoryDetails: listingCategoryDetailsSchema,
};

const listingDraftNumberFields = {
  price: z
    .string()
    .trim()
    .min(1, "Enter a price.")
    .transform(Number)
    .pipe(listingPriceSchema),
};

export const marketplaceListingCreateFormSchema = z
  .object({
    ...listingTextFields,
    ...listingDraftNumberFields,
    quantity: z
      .string()
      .trim()
      .min(1, "Enter a quantity.")
      .transform(Number)
      .pipe(listingQuantitySchema.min(1, "Enter a quantity of at least one.")),
    photoFiles: z.array(imageFileSchema).max(MARKETPLACE_IMAGE_MAX_COUNT),
  })
  .superRefine(validateCategoryDetails);

export const marketplaceListingUpdateFormSchema = z
  .object({
    ...listingTextFields,
    ...listingDraftNumberFields,
    quantity: z
      .string()
      .trim()
      .min(1, "Enter a quantity.")
      .transform(Number)
      .pipe(listingQuantitySchema),
    status: listingStatusSchema,
  })
  .superRefine(validateCategoryDetails);

export const marketplaceListingCreateSchema = z
  .object({
    sellerId: z.string().uuid(),
    sellerName: z.string().trim().min(1).max(80),
    ...listingTextFields,
    price: listingPriceSchema,
    quantity: listingQuantitySchema.min(1),
    photoFiles: z
      .array(imageFileSchema)
      .max(MARKETPLACE_IMAGE_MAX_COUNT),
  })
  .superRefine(validateCategoryDetails);

export const marketplaceListingUpdateSchema = z
  .object({
    id: z.string().uuid(),
    sellerId: z.string().uuid(),
    ...listingTextFields,
    price: listingPriceSchema,
    quantity: listingQuantitySchema,
    status: listingStatusSchema,
  })
  .superRefine(validateCategoryDetails);
