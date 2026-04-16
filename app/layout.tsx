import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PatentIQ — USPTO Examiner Intelligence",
  description: "Search 18,110 USPTO patent examiners. See allowance rates, rejection patterns, interview stats, and AI-powered prosecution strategy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
