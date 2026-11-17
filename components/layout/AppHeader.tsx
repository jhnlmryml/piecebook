"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeQuestionMark, Home, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { getInitials } from "@/lib/get-initials";
import { HeaderUserSkeleton } from "@/components/shared/LoadingSkeletons";

type AppHeaderProps = {
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
};

export default function AppHeader({
  searchTerm,
  onSearchTermChange,
}: AppHeaderProps) {
  const { currentUser, isLoading, allUsers, switchUser } = useAuth();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isProfilePage = pathname === "/profile" || pathname.startsWith("/profile/");
  const isFriendsPage = pathname === "/friends";

  const search = onSearchTermChange ? (
    <InputGroup className="h-9 border-0 bg-search-background text-search-foreground">
      <InputGroupInput
        aria-label="Search wall posts"
        value={searchTerm ?? ""}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="Search"
      />
      <InputGroupAddon align="inline-end">
        <Search aria-hidden="true" className="size-4" />
      </InputGroupAddon>
    </InputGroup>
  ) : null;

  return (
    <header className="piecebook-header sticky top-0 z-30 shrink-0">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-5"
      >
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold tracking-tight sm:text-2xl"
            aria-current={isHomePage ? "page" : undefined}
          >
            piecebook
          </Link>

          <div className="ml-10 hidden items-center gap-5 text-sm md:flex">
            <Link
              className={
                isHomePage
                  ? "font-semibold"
                  : "text-white/75 hover:text-white"
              }
              href="/"
              aria-current={isHomePage ? "page" : undefined}
            >
              Home
            </Link>
            <Link
              className={
                isProfilePage
                  ? "font-semibold"
                  : "text-white/75 hover:text-white"
              }
              href="/profile"
              aria-current={isProfilePage ? "page" : undefined}
            >
              Profile
            </Link>
            <Link
              className={
                isFriendsPage
                  ? "font-semibold"
                  : "text-white/75 hover:text-white"
              }
              href="/friends"
              aria-current={isFriendsPage ? "page" : undefined}
            >
              Friends
            </Link>
            <div className="ml-auto hidden w-56 lg:block">{search}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center justify-between gap-4 md:ml-0">
          <ThemeToggle />
          {isLoading || !currentUser ? (
            <div className="rounded-sm px-2 py-1">
              <HeaderUserSkeleton />
            </div>
          ) : (
            <>
              <span className="hidden truncate text-sm font-medium sm:block">
                {currentUser.full_name}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      aria-label={`Current profile: ${currentUser.full_name}. Switch profile`}
                    >
                      <Avatar className="size-8">
                        <AvatarImage
                          src={currentUser.image}
                          alt={currentUser.full_name}
                        />
                        <AvatarFallback className="piecebook-avatar-fallback">
                          {getInitials(currentUser.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="w-72 rounded-sm border border-border bg-popover p-1 text-popover-foreground"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="piecebook-muted-text px-2 py-2 text-xs">
                      <Tooltip>
                        <TooltipTrigger className="flex w-full items-center gap-2">
                          <BadgeQuestionMark aria-hidden="true" className="size-4" />
                          Switch demo profile
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Switch profiles to see realtime wall updates.</p>
                        </TooltipContent>
                      </Tooltip>
                    </DropdownMenuLabel>
                    {allUsers
                      .filter((user) => user.id !== currentUser.id)
                      .map((user) => (
                        <DropdownMenuItem
                          key={user.id}
                          onClick={() => switchUser(user.id)}
                          className="cursor-pointer rounded-sm p-0"
                        >
                          <Item className="w-full gap-3 border-0 px-2 py-2">
                            <ItemMedia variant="image">
                              <Avatar className="size-8">
                                <AvatarImage src={user.image} alt="" />
                                <AvatarFallback className="piecebook-avatar-fallback">
                                  {getInitials(user.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-sm">
                                {user.full_name}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </nav>

      {search && (
        <div className="border-t border-white/10 px-3 py-2 lg:hidden sm:px-5">
          <div className="mx-auto max-w-6xl">{search}</div>
        </div>
      )}

      <div className="grid grid-cols-3 border-t border-white/10 md:hidden">
        <Link
          className={`flex min-h-10 items-center justify-center gap-2 text-xs ${
            isHomePage ? "font-medium text-white" : "text-white/80"
          }`}
          href="/"
          aria-current={isHomePage ? "page" : undefined}
        >
          <Home aria-hidden="true" className="size-4" />
          Home
        </Link>
        <Link
          className={`flex min-h-10 items-center justify-center gap-2 text-xs ${
            isProfilePage ? "font-medium text-white" : "text-white/80"
          }`}
          href="/profile"
          aria-current={isProfilePage ? "page" : undefined}
        >
          Profile
        </Link>
        <Link
          className={`flex min-h-10 items-center justify-center gap-2 text-xs ${
            isFriendsPage ? "font-medium text-white" : "text-white/80"
          }`}
          href="/friends"
          aria-current={isFriendsPage ? "page" : undefined}
        >
          <Users aria-hidden="true" className="size-4" />
          Friends
        </Link>
      </div>
    </header>
  );
}
