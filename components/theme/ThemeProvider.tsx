"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { useState } from "react";
import type { ComponentProps } from "react";

const TAB_THEME_KEY = "piecebook-tab-theme";

function isThemePreference(
  value: string | null,
): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}

function createTabStorageId() {
  return (
    window.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function getInitialTabTheme(storageKey: string, defaultTheme: string) {
  if (typeof window === "undefined") {
    return { storageKey, defaultTheme };
  }

  let savedTheme: string | null = null;

  try {
    const sessionTheme = window.sessionStorage.getItem(TAB_THEME_KEY);
    const previousTheme = window.localStorage.getItem(storageKey);
    if (isThemePreference(sessionTheme)) {
      savedTheme = sessionTheme;
    } else if (isThemePreference(previousTheme)) {
      savedTheme = previousTheme;
    }
  } catch {
    // Continue with the configured default when browser storage is unavailable.
  }

  return {
    storageKey: `${storageKey}-${createTabStorageId()}`,
    defaultTheme: savedTheme ?? defaultTheme,
  };
}

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  const baseStorageKey = props.storageKey ?? "theme";
  const baseDefaultTheme = props.defaultTheme ?? "system";
  const [tabTheme] = useState(() =>
    getInitialTabTheme(baseStorageKey, baseDefaultTheme),
  );

  return (
    <NextThemesProvider
      {...props}
      storageKey={tabTheme.storageKey}
      defaultTheme={tabTheme.defaultTheme}
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTabTheme() {
  const theme = useNextTheme();

  function setTheme(nextTheme: Parameters<typeof theme.setTheme>[0]) {
    const preference =
      typeof nextTheme === "function"
        ? nextTheme(theme.theme ?? "system")
        : nextTheme;

    try {
      window.sessionStorage.setItem(TAB_THEME_KEY, preference);
    } catch {
      // The current tab can still change themes without browser storage.
    }

    theme.setTheme(nextTheme);
  }

  return { ...theme, setTheme };
}
