import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// https://astro.build/config
export default defineConfig({
  site: "https://freegamersworld.com",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Shared theme package (schema, layouts, components, MDX, styles).
        "@shared": fileURLToPath(new URL("../_shared/src", import.meta.url)),
      },
    },
    server: {
      // The shared theme lives outside this project root — allow Vite to read
      // the monorepo root so imports and global.css resolve.
      fs: {
        allow: [fileURLToPath(new URL("../..", import.meta.url))],
      },
    },
  },
});
