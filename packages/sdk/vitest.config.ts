import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  // Prevent vite from picking up the root postcss/tailwind config
  css: { postcss: { plugins: [] } },
});
