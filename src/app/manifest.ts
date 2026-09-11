import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dayweave · 日常有序",
    short_name: "Dayweave",
    description: "Study, work, and room to breathe.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#234c3e",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
