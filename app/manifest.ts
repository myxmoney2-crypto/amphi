import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AMFI",
    short_name: "AMFI",
    description: "Focus sur le prof. Le reste est géré.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7EE",
    theme_color: "#0E0E10",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
