import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { ShanEditor } from "shan";
import "./globals.css";

const sans = Outfit({
  variable: "--font-sans-loaded",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sable",
  description: "A private account. A card, a transfer, and the member who holds them.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <ShanEditor />
      </body>
    </html>
  );
}
