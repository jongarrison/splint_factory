import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthProvider from "@/components/auth/AuthProvider";
import VirtualKeyboard from "@/components/VirtualKeyboard";
import SettingsButton from "@/components/ReloadButton";
import KeyboardToggleButton from "@/components/KeyboardToggleButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Splint Factory",
  description: "Custom orthotics manufacturing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <KeyboardToggleButton />
          <SettingsButton />
          <VirtualKeyboard />
        </AuthProvider>
      </body>
    </html>
  );
}
