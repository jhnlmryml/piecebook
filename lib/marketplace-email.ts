import { marketplaceEmailSchema } from "@/lib/form-schemas";

export function isValidMarketplaceEmail(value: string): boolean {
  return marketplaceEmailSchema.safeParse(value).success;
}
