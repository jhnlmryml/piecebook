"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabTheme } from "@/components/theme/ThemeProvider";

const themeOptions = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Device", Icon: Monitor },
] as const;

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { setTheme, theme } = useTabTheme();
  const hasMounted = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot,
  );
  const selectedTheme = hasMounted ? (theme ?? "system") : "system";
  const selectedOption =
    themeOptions.find((option) => option.value === selectedTheme) ??
    themeOptions[2];
  const ThemeIcon = selectedOption.Icon;

  function cycleTheme() {
    const currentIndex = themeOptions.findIndex(
      (option) => option.value === theme,
    );
    const nextOption = themeOptions[(currentIndex + 1) % themeOptions.length];
    setTheme(nextOption.value);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Change color theme. Current theme: ${selectedOption.label}`}
      title={`Theme: ${selectedOption.label}`}
      onClick={cycleTheme}
      className="shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ThemeIcon aria-hidden="true" className="size-4" />
    </Button>
  );
}
