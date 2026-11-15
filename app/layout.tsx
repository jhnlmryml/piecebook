import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Titillium_Web } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import {TooltipProvider} from "@/components/ui/tooltip";

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

const wordMark = Titillium_Web({
  variable:"--font-wordmark",
  subsets: ["latin"],
  weight: ["700"],
});
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Piecebook",
  description: "2008 Facebook-style Wall for your thoughts, ideas, and memories.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-mono", jetbrainsMono.variable, wordMark.variable)}
    >
      <body className="min-h-full flex flex-col"><TooltipProvider>{children}</TooltipProvider></body>
    </html>
  );
}
