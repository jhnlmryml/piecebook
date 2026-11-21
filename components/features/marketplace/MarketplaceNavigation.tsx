"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Bike,
  Bookmark,
  CarFront,
  Clapperboard,
  ClipboardList,
  CircleDollarSign,
  Gamepad2,
  Grid2x2,
  Guitar,
  Heart,
  Home,
  Laptop,
  PackagePlus,
  Plus,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getMarketplaceListingsSnapshot,
  getServerMarketplaceListingsSnapshot,
  marketplaceCategories,
  subscribeToMarketplaceListings,
  type Category,
} from "./marketplace-data";
import { useMarketplaceLayout, type MarketplaceView } from "./MarketplaceLayoutContext";

const categoryIcons: Record<Category, LucideIcon> = {
  Vehicles: CarFront,
  "Property Rentals": Home,
  Apparel: Shirt,
  Classifieds: Tag,
  Electronics: Laptop,
  Entertainment: Clapperboard,
  Family: Users,
  "Free Stuff": PackagePlus,
  "Garden & Outdoor": Sparkles,
  Hobbies: Gamepad2,
  "Home Goods": Home,
  "Home Improvement Supplies": Wrench,
  "Home Sales": Home,
  "Musical Instruments": Guitar,
  "Office Supplies": Laptop,
  "Pet Supplies": Heart,
  "Sporting Goods": Bike,
  "Toys & Games": Gamepad2,
};

const viewItems: { label: string; view: MarketplaceView; icon: LucideIcon }[] = [
  { label: "Manage your listings", view: "selling", icon: ClipboardList },
  { label: "Saved items", view: "saved", icon: Bookmark },
  { label: "Purchase history", view: "purchases", icon: ShoppingBag },
  { label: "Sales history", view: "sales", icon: CircleDollarSign },
];

export function MarketplaceNavigation() {
  const {
    activeView,
    activeCategory,
    savedListingIds,
    chooseView,
    chooseCategory,
    openCreateListing,
  } = useMarketplaceLayout();
  const { currentUser } = useProfile();
  const { isMobile, setOpenMobile } = useSidebar();
  const listingsSnapshot = useSyncExternalStore(
    subscribeToMarketplaceListings,
    getMarketplaceListingsSnapshot,
    getServerMarketplaceListingsSnapshot,
  );
  const listings = listingsSnapshot.listings;
  const categoryCounts = useMemo(
    () => {
      const counts = Object.fromEntries(
        marketplaceCategories.map((category) => [category, 0]),
      ) as Record<Category, number>;
      for (const listing of listings) counts[listing.category] += 1;
      return counts;
    },
    [listings],
  );
  const sellingCount = useMemo(
    () => listings.filter((listing) => listing.sellerId === currentUser?.id).length,
    [currentUser?.id, listings],
  );

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };
  const selectView = (view: MarketplaceView) => {
    chooseView(view);
    closeMobileSidebar();
  };
  const selectCategory = (category: Category | null) => {
    chooseCategory(category);
    closeMobileSidebar();
  };
  const createListing = () => {
    openCreateListing();
    closeMobileSidebar();
  };

  const formatCount = (count: number) => count > 99 ? "99+" : count.toLocaleString();

  return (
    <>
      <SidebarGroup className="px-0 py-2">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={createListing}
                tooltip="Create new listing"
                className="h-11 gap-3 rounded-xl font-semibold text-primary transition-colors hover:bg-primary/10 group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center!"
              >
                <Plus className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">Create new listing</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {viewItems.map(({ label, view, icon: Icon }) => (
              <SidebarMenuItem key={view}>
                <SidebarMenuButton
                  type="button"
                  isActive={activeView === view}
                  onClick={() => selectView(view)}
                  tooltip={`${label}${view === "saved" || view === "selling" ? ` · ${formatCount(view === "saved" ? savedListingIds.length : sellingCount)} items` : ""}`}
                  className={`h-10 gap-3 rounded-xl pr-8 text-sm transition-colors group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center! ${activeView === view ? "bg-primary/10! font-semibold! text-primary!" : "hover:bg-muted/70"}`}
                >
                  <Icon className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                </SidebarMenuButton>
                {(view === "saved" || view === "selling") && (
                  <SidebarMenuBadge>{formatCount(view === "saved" ? savedListingIds.length : sellingCount)}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mx-0 w-full opacity-70" />

      <SidebarGroup className="px-0 py-2">
        <SidebarGroupLabel className="h-8 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Categories
          {activeCategory && (
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className="ml-auto rounded-full px-2 py-1 text-[10px] font-semibold normal-case tracking-normal text-primary transition-colors hover:bg-primary/10"
            >
              Clear
            </button>
          )}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton type="button" isActive={!activeCategory && activeView === "browse"} onClick={() => selectCategory(null)} tooltip={`All categories · ${formatCount(listings.length)} items`} className={`h-10 gap-3 rounded-xl pr-8 text-sm transition-colors group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center! ${!activeCategory && activeView === "browse" ? "bg-primary/10! font-semibold! text-primary!" : "hover:bg-muted/70"}`}>
                <Grid2x2 className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">All categories</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{formatCount(listings.length)}</SidebarMenuBadge>
            </SidebarMenuItem>
            {marketplaceCategories.map((category) => {
              const Icon = categoryIcons[category];
              return (
                <SidebarMenuItem key={category}>
                  <SidebarMenuButton type="button" isActive={activeCategory === category} onClick={() => selectCategory(category)} tooltip={`${category} · ${formatCount(categoryCounts[category] ?? 0)} listings`} className={`h-10 gap-3 rounded-xl pr-8 text-sm transition-colors group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center! ${activeCategory === category ? "bg-primary/10! font-semibold! text-primary!" : "hover:bg-muted/70"}`}>
                    <Icon className="size-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{category}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{formatCount(categoryCounts[category] ?? 0)}</SidebarMenuBadge>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
