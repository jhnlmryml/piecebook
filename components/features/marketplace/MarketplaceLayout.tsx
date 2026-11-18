"use client";

import type { ReactNode } from "react";
import { Bookmark, Plus, Tag } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialContent,
  SpeedDialItem,
  SpeedDialLabel,
  SpeedDialTrigger,
} from "@/components/ui/speed-dial";
import { MarketplaceLayoutProvider, useMarketplaceLayout } from "./MarketplaceLayoutContext";
import { MarketplaceNavigation } from "./MarketplaceNavigation";

function MarketplaceSidebarFrame({ children }: { children: ReactNode }) {
  const { activeView, activeCategory } = useMarketplaceLayout();
  const title = activeCategory ?? (activeView === "selling" ? "Selling" : activeView === "saved" ? "Buying" : "Marketplace");

  return (
    <SidebarProvider className="!min-h-0 h-full flex-1 [--sidebar:var(--card)] [--sidebar-foreground:var(--foreground)] [--sidebar-accent:var(--muted)] [--sidebar-accent-foreground:var(--foreground)] [--sidebar-border:var(--border)] [--sidebar-ring:var(--ring)]">
      <Sidebar collapsible="icon" aria-label="Marketplace navigation" className="shrink-0 border-r border-border bg-card text-foreground [--sidebar:var(--card)] [--sidebar-foreground:var(--foreground)] [--sidebar-accent:var(--muted)] [--sidebar-accent-foreground:var(--foreground)] [--sidebar-border:var(--border)] [--sidebar-ring:var(--ring)] max-md:!hidden md:!top-14 md:!bottom-0 md:!h-auto">
        <SidebarHeader className="shrink-0 px-3 pb-2 pt-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
          <div className="flex w-full items-start justify-between gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="min-w-0 px-1 group-data-[collapsible=icon]:hidden">
              <p className="text-xs text-muted-foreground">Marketplace</p>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            </div>
            <SidebarTrigger
              aria-label="Toggle Marketplace sidebar"
              className="size-8 shrink-0 rounded-sm border border-border bg-card text-foreground hover:bg-muted"
            />
          </div>
        </SidebarHeader>
        <SidebarContent className="scrollbar-hide px-3 pb-6 group-data-[collapsible=icon]:px-2"><MarketplaceNavigation /></SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="min-h-0 min-w-0 flex-1">{children}</div>
          <MarketplaceMobileSpeedDial />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MarketplaceMobileSpeedDial() {
  const { activeView, chooseView, openCreateListing } = useMarketplaceLayout();

  return (
    <SpeedDial side="top" className="fixed bottom-5 right-4 z-40 md:hidden">
      <SpeedDialTrigger
        aria-label="Open Marketplace actions"
        className="size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 data-[state=closed]:rotate-0 data-[state=open]:rotate-135"
      >
        <Plus className="size-6" />
        <span className="sr-only">Marketplace actions</span>
      </SpeedDialTrigger>
      <SpeedDialContent className="gap-3">
        <SpeedDialItem>
          <SpeedDialLabel className={`bg-accent`}>Create new listing</SpeedDialLabel>
          <SpeedDialAction aria-label="Create new listing" onSelect={openCreateListing}>
            <Plus />
          </SpeedDialAction>
        </SpeedDialItem>
        <SpeedDialItem>
          <SpeedDialLabel className={`bg-accent ${activeView === "saved" ? "text-primary" : undefined}`} >Saved items</SpeedDialLabel>
          <SpeedDialAction
            aria-label="Saved items"
            onSelect={() => chooseView("saved")}
            className={activeView === "saved" ? "text-primary" : undefined}
          >
            <Bookmark />
          </SpeedDialAction>
        </SpeedDialItem>
        <SpeedDialItem >
          <SpeedDialLabel  className={`bg-accent ${activeView === "selling" ? "text-primary" : undefined}`}>Selling</SpeedDialLabel>
          <SpeedDialAction
            aria-label="Selling"
            onSelect={() => chooseView("selling")}
            className={activeView === "selling" ? "text-primary" : undefined}
          >
            <Tag />
          </SpeedDialAction>
        </SpeedDialItem>
      </SpeedDialContent>
    </SpeedDial>
  );
}

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return <MarketplaceLayoutProvider><MarketplaceSidebarFrame>{children}</MarketplaceSidebarFrame></MarketplaceLayoutProvider>;
}

