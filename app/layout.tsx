import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProfileProvider } from "@/context/ProfileContext";
import {TooltipProvider} from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster as ShadcnToaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Piecebook @ JHNLMRYML",
    template: "%s | Piecebook",
  },
  description:
    "A place for your friends, photos, and everyday updates — inspired by the original Facebook Wall.",
  applicationName: "Piecebook",
  keywords: ["Piecebook", "social wall", "friends", "photos"],
  openGraph: {
    title: "Piecebook @ JHNLMRYML",
    description:
      "A place for your friends, photos, and everyday updates — inspired by the original Facebook Wall.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-dvh overflow-hidden antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ProfileProvider>
            <TooltipProvider>
              <AppShell>{children}</AppShell>
              <ShadcnToaster position="top-center" richColors />
            </TooltipProvider>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
