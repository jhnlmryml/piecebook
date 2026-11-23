"use client";

import type { ReactNode } from "react";
import {
  Bookmark,
  ClipboardList,
  CircleDollarSign,
  Compass,
  History,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MarketplaceLayoutProvider, useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { MarketplaceNavigation } from "./MarketplaceNavigation";

function MarketplaceSidebarFrame({ children }: { children: ReactNode }) {
  const { activeView, activeCategory } = useMarketplaceLayout();
  const title = activeCategory ?? (
    activeView === "selling" ? "Seller Dashboard" :
    activeView === "saved" ? "Saved items" :
    activeView === "purchases" ? "Purchase history" :
    activeView === "sales" ? "Sales history" : "Marketplace"
  );

  return (
    <SidebarProvider className="min-h-0! h-full flex-1 bg-background [--sidebar:var(--card)] [--sidebar-foreground:var(--foreground)] [--sidebar-accent:var(--muted)] [--sidebar-accent-foreground:var(--foreground)] [--sidebar-border:var(--border)] [--sidebar-ring:var(--ring)]">
      <Sidebar collapsible="icon" aria-label="Marketplace navigation" className="shrink-0 border-r border-border/70 bg-card/95 text-foreground backdrop-blur-xl [--sidebar:var(--card)] [--sidebar-foreground:var(--foreground)] [--sidebar-accent:var(--muted)] [--sidebar-accent-foreground:var(--foreground)] [--sidebar-border:var(--border)] [--sidebar-ring:var(--ring)] max-md:hidden! md:top-14! md:bottom-0! md:h-auto!">
        <SidebarHeader className="shrink-0 px-3 pb-3 pt-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <div className="flex w-full items-start justify-between gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="min-w-0 px-1 group-data-[collapsible=icon]:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Marketplace
              </p>
              <h1 className="mt-1 truncate text-xl font-bold tracking-tight">
                {title}
              </h1>
            </div>
            <SidebarTrigger
              aria-label="Toggle Marketplace sidebar"
              className="size-9 shrink-0 rounded-full border border-border/70 bg-card text-foreground shadow-sm transition hover:bg-muted"
            />
          </div>
        </SidebarHeader>
        <SidebarContent className="scrollbar-hide px-3 pb-6 group-data-[collapsible=icon]:px-2">
          <MarketplaceNavigation />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-linear-to-br from-background via-background to-primary/5">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="min-h-0 min-w-0 flex-1">{children}</div>
          <MarketplaceMobileBottomNavigation />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MarketplaceMobileBottomNavigation() {
  const { activeView, chooseView, openCreateListing } = useMarketplaceLayout();
  const items = [
    { view: "browse" as const, label: "Browse", Icon: Compass },
    { view: "saved" as const, label: "Saved items", Icon: Bookmark },
    {
      view: "selling" as const,
      label: "Seller Dashboard",
      Icon: ClipboardList,
    },
    { view: "purchases" as const, label: "Purchase history", Icon: ShoppingBag },
    { view: "sales" as const, label: "Sales history", Icon: CircleDollarSign },
  ];
  const renderNavigationItem = ({
    view,
    label,
    Icon,
  }: (typeof items)[number]) => {
    const isActive = activeView === view;
    return (
      <Button
        key={view}
        type="button"
        variant="ghost"
        aria-current={isActive ? "page" : undefined}
        aria-label={label}
        title={label}
        onClick={() => chooseView(view)}
        className={`h-14 w-full flex-col gap-0 rounded-xl p-0 transition-colors hover:bg-muted/60 ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <span
          className={`flex size-10 items-center justify-center rounded-2xl transition-colors ${
            isActive ? "bg-primary/10 text-primary" : ""
          }`}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="sr-only">{label}</span>
      </Button>
    );
  };
  const isHistoryActive =
    activeView === "purchases" || activeView === "sales";

  return (
    <nav
      aria-label="Marketplace bottom navigation"
      className="shrink-0 border-t border-border/70 bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid h-16 w-full max-w-lg grid-cols-5 items-center px-2">
        {renderNavigationItem(items[0])}
        {renderNavigationItem(items[1])}
        <Button
          type="button"
          variant="default"
          aria-label="Create new listing"
          title="Create new listing"
          onClick={openCreateListing}
          className="mx-auto size-11 rounded-full border-[3px] border-card bg-primary p-0 text-primary-foreground transition-transform hover:scale-105 hover:bg-primary"
        >
          <Plus aria-hidden="true" className="size-5" />
        </Button>
        {renderNavigationItem(items[2])}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                aria-label="Order history"
                title="Order history"
                aria-current={isHistoryActive ? "page" : undefined}
                className={`h-14 w-full flex-col gap-0 rounded-xl p-0 transition-colors hover:bg-muted/60 ${
                  isHistoryActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-2xl transition-colors ${
                    isHistoryActive ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <History aria-hidden="true" className="size-5" />
                </span>
                <span className="sr-only">Order history</span>
              </Button>
            }
          />
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="mb-1 w-48 rounded-2xl border border-border bg-popover p-1"
          >
            <DropdownMenuItem
              onClick={() => chooseView("purchases")}
              className="cursor-pointer rounded-xl py-3 text-sm"
            >
              <ShoppingBag aria-hidden="true" className="size-4" />
              Purchase history
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => chooseView("sales")}
              className="cursor-pointer rounded-xl py-3 text-sm"
            >
              <CircleDollarSign aria-hidden="true" className="size-4" />
              Sales history
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <MarketplaceLayoutProvider>
      <MarketplaceSidebarFrame>{children}</MarketplaceSidebarFrame>
    </MarketplaceLayoutProvider>
  );
}

