import type { NextConfig } from "next";

export const PWA_CONFIG = {
  name: "LegendaAI",
  short_name: "LegendaAI",
  theme_color: "#AAFF00",
  background_color: "#0A0A0A",
  display: "standalone",
  orientation: "portrait",
  scope: "/",
  start_url: "/dashboard",
  icons: [
    { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
  ],
} as const;

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
