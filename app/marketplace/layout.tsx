import type { ReactNode } from "react";
import MarketplaceLayout from "@/components/features/marketplace/MarketplaceLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <MarketplaceLayout>{children}</MarketplaceLayout>;
}
