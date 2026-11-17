"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { USERS } from "@/data/demo-users";
import type { AuthContextValue } from "@/types/auth-context";

const SESSION_STORAGE_KEY = "piecebook_session_user_id";
const DEFAULT_USER =
  USERS.find((user) => user.email === "luffy@onepiece.com") ?? USERS[0];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSavedUserId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveUserId(userId: string): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, userId);
  } catch {
    // The in-memory profile picker still works when storage is unavailable.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] =
    useState<AuthContextValue["currentUser"]>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(() => {
      if (!isMounted) return;

      const savedUserId = readSavedUserId();
      const sessionUser =
        USERS.find((user) => user.id === savedUserId) ?? DEFAULT_USER;

      saveUserId(sessionUser.id);
      setCurrentUser(sessionUser);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const switchUser = useCallback((userId: string) => {
    const targetUser = USERS.find((user) => user.id === userId);
    if (!targetUser) return;

    saveUserId(targetUser.id);
    setCurrentUser(targetUser);
  }, []);

  const contextValue = useMemo(
    () => ({
      currentUser,
      isLoading,
      switchUser,
      allUsers: USERS,
    }),
    [currentUser, isLoading, switchUser],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
