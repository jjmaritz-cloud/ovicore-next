import type { Metadata } from "next";
import "@ag-grid-community/styles/ag-grid.css";
import "@ag-grid-community/styles/ag-theme-quartz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "OviCore",
  description: "Plan with confidence. Forecast with precision.",
  icons: {
    icon: "/OviCore_egg_icon.png",
    shortcut: "/OviCore_egg_icon.png",
    apple: "/OviCore_egg_icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}