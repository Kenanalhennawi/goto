import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "GO TO | flydubai Contact Centre",
  description: "Searchable product & process guide for flydubai Contact Centre agents",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // AUTH-UX-1: operational search surfaces are mounted only for an
  // authenticated session, so signed-out public auth pages never load the
  // command palette, never bind operational keyboard shortcuts and never
  // issue a /api/search request. Route protection stays in proxy.ts.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base text-ink">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        {user ? (
          <>
            <CommandPalette />
            <KeyboardShortcuts />
          </>
        ) : null}
      </body>
    </html>
  );
}
