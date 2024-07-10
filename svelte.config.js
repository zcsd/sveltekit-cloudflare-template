import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-cloudflare";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      routes: {
        include: ["/*"],
        exclude: ["<all>"],
      },
    }),
    alias: {
      $lib: "./src/lib",
      $config: "./src/config.js",
      $appcss: "./src/app.css",
      $store: "./src/store.js",
    },
  },

  preprocess: [vitePreprocess({})],
};

export default config;
