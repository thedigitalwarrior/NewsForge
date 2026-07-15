import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// https://astro.build/config
export default defineConfig({
  site: "https://tabletnexus.com",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Shared theme package (schema, and later layouts/components/MDX).
        "@shared": fileURLToPath(new URL("../_shared/src", import.meta.url)),
      },
    },
    server: {
      // The news collection loads fixtures from sites/_shared/, which lives
      // outside this project root — allow Vite to read the monorepo root.
      fs: {
        allow: [fileURLToPath(new URL("../..", import.meta.url))],
      },
    },
  },
});
