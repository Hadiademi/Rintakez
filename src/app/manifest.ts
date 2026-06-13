import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rintakez",
    short_name: "Rintakez",
    description: "Fotografie-Marktplatz Schweiz",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c8462c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
