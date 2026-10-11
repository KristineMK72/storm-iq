import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

export default defineConfig({
  integrations: [react()],
  output: "static",
  adapter: vercel({
    // Hybrid: mostly static, SSR only where prerender=false (map page + /api/og)
  }),
});
