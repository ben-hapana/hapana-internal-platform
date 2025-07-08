import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/firebase-auth'
import { LayoutWrapper } from '@/components/layout-wrapper'

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Hapana Central",
  description: "Platform engineering dashboard for QA automation and support management",
  keywords: ["platform engineering", "QA", "support", "automation", "Hapana"],
  authors: [{ name: "Hapana Engineering Team" }],
  openGraph: {
    title: "Hapana Central",
    description: "Platform engineering dashboard for QA automation and support management",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} antialiased min-h-screen bg-background font-outfit`}
      >
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
