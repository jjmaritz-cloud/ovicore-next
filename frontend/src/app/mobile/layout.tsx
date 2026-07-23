import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "OviCore Mobile",
  description: "Offline poultry daily entry, module access and operations insights.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OviCore",
  },
};

export const viewport: Viewport = {
  themeColor: "#08261f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
