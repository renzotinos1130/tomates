import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeSync } from "@/components/app/theme";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_BOOT_SCRIPT, THEME_COLOR } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Team Tomate HQ", template: "%s · Team Tomate HQ" },
  description: "Le QG de l'équipe Prospero : projets, tâches et meeting hebdomadaire.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.day,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The script below may add data-theme before React arrives: the attribute is not React's to compare.
    <html lang="fr-CA" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* The evening theme, decided before the first paint (see lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeSync />
        <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
