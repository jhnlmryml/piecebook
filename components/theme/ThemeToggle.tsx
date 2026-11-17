"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const themeOptions = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Device", Icon: Monitor },
] as const;

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
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
      className="shrink-0 rounded-full text-white hover:bg-white/10 hover:text-white"
    >
      <ThemeIcon aria-hidden="true" className="size-3.5" />
    </Button>
  );
}
