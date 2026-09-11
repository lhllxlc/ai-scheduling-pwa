import type { Metadata, Viewport } from "next";
import "./globals.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#234c3e",
};
export const metadata: Metadata = {
  title: "Dayweave · 日常有序",
  description: "A realistic rhythm for study, work and life.",
  applicationName: "Dayweave",
  icons: { apple: "/icon-180.png", icon: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Dayweave", statusBarStyle: "default" },
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
