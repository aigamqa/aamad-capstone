import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppBar } from "@/components/AppBar";
// Note: Geist font removed — Next.js 14.2 does not include Geist in next/font/google;
// using local fonts from GeistVF.woff bundled by create-next-app instead.

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AI Sales Team — MVP Dashboard",
  description: "Human-in-the-loop proposal review dashboard for AI Sales Team MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}>
        <TooltipProvider>
          {/* App bar — h-16 sticky top-0 per wireframe spec */}
          <AppBar />
          {/* Main content area — offset by app bar height */}
          <main className="pt-16">{children}</main>
        </TooltipProvider>
        {/* Global toast provider */}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
