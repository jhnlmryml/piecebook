"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeQuestionMark,
  CircleUserRoundIcon,
  Home,
  Loader2,
  Search,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MessagingCenter } from "@/components/features/messaging/MessagingCenter";
import { useProfile } from "@/context/ProfileContext";
import { getInitials } from "@/lib/get-initials";
import { HeaderUserSkeleton } from "@/components/shared/LoadingSkeletons";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type AppHeaderProps = {
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
};

type NavigationLinkProps = {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  mobile?: boolean;
};

function NavigationLink({
  href,
  label,
  Icon,
  active,
  mobile = false,
}: NavigationLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={mobile ? label : undefined}
      className={
        mobile
          ? `flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors hover:bg-accent/70 ${active ? "font-semibold text-primary" : "text-muted-foreground"
          }`
          : `flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground ${active
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground"
          }`
      }
    >
      <Icon aria-hidden="true" className={mobile ? "size-5" : "size-4"} />
      <span>{label}</span>
    </Link>
  );
}

export default function AppHeader({
  searchTerm,
  onSearchTermChange,
}: AppHeaderProps) {
  const {
    currentUser,
    profileError,
    isLoading,
    isSwitching,
    allUsers,
    switchProfile,
  } = useProfile();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isProfilePage =
    pathname === "/profile" || pathname.startsWith("/profile/");
  const isFriendsPage = pathname === "/friends";
  const isMarketplacePage = pathname === "/marketplace";

  const navigationItems = [
    { href: "/", label: "Home", Icon: Home, active: isHomePage },
    {
      href: "/profile",
      label: "Profile",
      Icon: CircleUserRoundIcon,
      active: isProfilePage,
    },
    { href: "/friends", label: "Friends", Icon: Users, active: isFriendsPage },
    {
      href: "/marketplace",
      label: "Marketplace",
      Icon: ShoppingBag,
      active: isMarketplacePage,
    },
  ];
  const switchableProfiles = allUsers.filter(
    (user) => user.id !== currentUser?.id,
  );

  const search =
    isHomePage && onSearchTermChange ? (
      <InputGroup className="h-10 rounded-xl border border-input/70 bg-muted/70 text-foreground transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
        <InputGroupInput
          aria-label="Search wall posts"
          value={searchTerm ?? ""}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search your wall"
        />
        <InputGroupAddon align="inline-end">
          <Search aria-hidden="true" className="size-4" />
        </InputGroupAddon>
      </InputGroup>
    ) : null;

  return (
    <header className="piecebook-header sticky top-0 z-30 shrink-0 p-2">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-14 max-w-7xl items-center gap-3 px-3 sm:px-5"
      >
        <div className="flex min-w-0 items-center">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-primary transition-opacity hover:opacity-80 sm:text-xl"
            aria-current={isHomePage ? "page" : undefined}
          >
            piecebook
          </Link>

          <div className="ml-5 hidden items-center gap-1 md:flex">
            {navigationItems.map((item) => (
              <NavigationLink key={item.href} {...item} />
            ))}
          </div>
        </div>

        <div className="ml-auto hidden w-64 shrink-0 lg:block mr-5">{search}</div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2 lg:ml-2">
          <ThemeToggle />
          <MessagingCenter />
          {isLoading ? (
            <div className="rounded-full px-2 py-1">
              <HeaderUserSkeleton />
            </div>
          ) : allUsers.length === 0 ? (
            <span
              className="piecebook-muted-text max-w-40 text-right text-xs"
              title={profileError ?? undefined}
            >
              {profileError ?? "No profiles available"}
            </span>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full ml-2"
                      aria-label={
                        currentUser
                          ? `Current profile: ${currentUser.full_name}. Switch profile`
                          : "Choose profile"
                      }
                    >
                      <Avatar className="size-8">
                        {currentUser?.image && (
                          <AvatarImage
                            src={currentUser.image}
                            alt={currentUser.full_name}
                          />
                        )}
                        <AvatarFallback className="piecebook-avatar-fallback">
                          {currentUser
                            ? getInitials(currentUser.full_name)
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-64 max-w-[calc(100vw-1rem)] rounded-2xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-xl"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="piecebook-muted-text px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Account
                    </DropdownMenuLabel>
                    <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-2.5 py-2 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {currentUser?.full_name ?? "Choose a profile"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {currentUser?.email ?? "No profile selected"}
                        </p>
                      </div>
                      <Avatar className="size-9 shrink-0 ring-2 ring-background">
                        {currentUser?.image && (
                          <AvatarImage src={currentUser.image} alt="" />
                        )}
                        <AvatarFallback className="piecebook-avatar-fallback text-xs">
                          {currentUser ? getInitials(currentUser.full_name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="my-1.5" />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="piecebook-muted-text px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                      <Tooltip>
                        <TooltipTrigger className="flex w-full items-center justify-start gap-1.5">
                          Switch profile
                          <BadgeQuestionMark
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Switch profiles to see realtime wall updates.</p>
                        </TooltipContent>
                      </Tooltip>
                    </DropdownMenuLabel>
                    {!currentUser && (
                      <p
                        role="status"
                        className="piecebook-muted-text px-2 pb-2 text-left text-xs"
                      >
                        {profileError ?? "Choose a profile to continue."}
                      </p>
                    )}
                    {switchableProfiles.length === 0 ? (
                      <p className="piecebook-muted-text px-2 py-2 text-left text-xs">
                        {currentUser
                          ? "You’re using the only available profile."
                          : "No profiles are available yet."}
                      </p>
                    ) : (
                      switchableProfiles.map((user) => (
                        <DropdownMenuItem
                          key={user.id}
                          disabled={isSwitching}
                          onClick={() => {
                            void switchProfile(user.id).catch(
                              (error: unknown) => {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not switch accounts.",
                                );
                              },
                            );
                          }}
                          className="flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-xl px-2 py-1.5 text-left"
                        >
                          <Avatar className="size-8 shrink-0">
                            {user.image && (
                              <AvatarImage src={user.image} alt="" />
                            )}
                            <AvatarFallback className="piecebook-avatar-fallback text-xs">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                            {user.full_name}
                          </span>
                          {isSwitching && (
                            <Loader2
                              aria-hidden="true"
                              className="size-4 shrink-0 animate-spin text-muted-foreground"
                            />
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </nav>

      {search && (
        <div className="border-t border-border/70 px-3 py-2 lg:hidden sm:px-5">
          <div className="mx-auto max-w-7xl">{search}</div>
        </div>
      )}

      <div className="grid grid-cols-4 border-t border-border/70 bg-background/80 md:hidden">
        {navigationItems.map((item) => (
          <NavigationLink key={item.href} {...item} mobile />
        ))}
      </div>
    </header>
  );
}
