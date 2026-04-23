import type { MetadataRoute } from "next";
import { PWA_CONFIG } from "../../next.config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PWA_CONFIG.name,
    short_name: PWA_CONFIG.short_name,
    theme_color: PWA_CONFIG.theme_color,
    background_color: PWA_CONFIG.background_color,
    display: PWA_CONFIG.display,
    orientation: PWA_CONFIG.orientation,
    scope: PWA_CONFIG.scope,
    start_url: PWA_CONFIG.start_url,
    icons: [...PWA_CONFIG.icons],
  };
}
