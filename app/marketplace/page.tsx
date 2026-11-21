import type { Metadata } from "next";
import MarketplacePage from "@/components/features/marketplace/MarketplacePage";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Discover local finds, shop nearby listings, and sell on Piecebook Marketplace.",
};

export default function Page() {
  return <MarketplacePage />;
}
