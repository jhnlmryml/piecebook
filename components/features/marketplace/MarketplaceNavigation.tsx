"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Bike,
  Bookmark,
  CarFront,
  Clapperboard,
  Gamepad2,
  Grid2x2,
  Guitar,
  Heart,
  Home,
  Laptop,
  PackagePlus,
  Plus,
  Shirt,
  Sparkles,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  getServerUserListingsSnapshot,
  getUserListingsSnapshot,
  initialListings,
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
  { label: "Buying", view: "saved", icon: Bookmark },
  { label: "Selling", view: "selling", icon: Tag },
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
  const { isMobile, setOpenMobile } = useSidebar();
  const userListings = useSyncExternalStore(
    subscribeToMarketplaceListings,
    getUserListingsSnapshot,
    getServerUserListingsSnapshot,
  );
  const listings = useMemo(() => [...initialListings, ...userListings], [userListings]);
  const categoryCounts = useMemo(
    () => Object.fromEntries(
      marketplaceCategories.map((category) => [
        category,
        listings.filter((listing) => listing.category === category).length,
      ]),
    ) as Record<Category, number>,
    [listings],
  );
  const sellingCount = listings.filter((listing) => listing.seller === "You").length;

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
                className="h-10 gap-3  font-semibold text-primary hover:bg-secondary group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center!"
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
                  tooltip={`${label} · ${formatCount(view === "saved" ? savedListingIds.length : sellingCount)} items`}
                  className={`h-10 gap-3 pr-8 text-sm group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center! ${activeView === view ? "!bg-secondary !font-semibold !text-primary" : "hover:bg-muted"}`}
                >
                 <Icon className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{formatCount(view === "saved" ? savedListingIds.length : sellingCount)}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mx-0 w-full" />

      <SidebarGroup className="px-0 py-2">
        <SidebarGroupLabel className="h-8 px-2 text-sm font-semibold text-foreground">
          Categories
          {activeCategory && <button type="button" onClick={() => selectCategory(null)} className="ml-auto text-xs font-medium text-primary">Clear</button>}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton type="button" isActive={!activeCategory && activeView === "browse"} onClick={() => selectCategory(null)} tooltip={`All categories · ${formatCount(listings.length)} items`} className={`h-10 gap-3 pr-8 text-sm group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center! ${!activeCategory && activeView === "browse" ? "!bg-secondary !font-semibold !text-primary" : "hover:bg-muted"}`}>
                <Grid2x2 className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">All categories</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{formatCount(listings.length)}</SidebarMenuBadge>
            </SidebarMenuItem>
            {marketplaceCategories.map((category) => {
              const Icon = categoryIcons[category];
              return (
                <SidebarMenuItem key={category}>
                  <SidebarMenuButton type="button" isActive={activeCategory === category} onClick={() => selectCategory(category)} tooltip={`${category} · ${formatCount(categoryCounts[category] ?? 0)} listings`} className={`h-10 gap-3 pr-8 text-sm group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center! ${activeCategory === category ? "!bg-secondary !font-semibold !text-primary" : "hover:bg-muted"}`}>
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
