import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json";

export default defineConfig(({ mode }) => {
  const isDesktop = mode === "desktop";

  const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || "")
    .split(",")
    .filter(Boolean);

  return {
    server: {
      allowedHosts,
    },
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
      "import.meta.env.VITE_BUILD_DATE": JSON.stringify(
        new Date().toISOString(),
      ),
      "import.meta.env.VITE_DESKTOP_BUILD": JSON.stringify(isDesktop),
    },
    optimizeDeps: {
      exclude: ["pdfjs-dist"],
    },
    plugins: [
      react(),
      VitePWA({
        // `disable` is supported by vite-plugin-pwa at runtime, but is not typed.
        disable: isDesktop,
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.svg",
          "favicon.ico",
          "favicon-16x16.png",
          "favicon-32x32.png",
          "apple-touch-icon.png",
          "android-chrome-192x192.png",
          "android-chrome-512x512.png",
        ],
        manifest: {
          name: "doff — diff workspace",
          short_name: "doff",
          description: "Local-first, offline-ready diff workspace.",
          theme_color: "#0d7a43",
          background_color: "#f2f4f6",
          display: "standalone",
          start_url: "/text",
          icons: [
            {
              src: "/android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/android-chrome-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          globIgnores: ["**/*worker*.js", "**/*worker*.mjs"],
          navigateFallback: "/index.html",
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /\/assets\/.*\.(?:js|mjs|css)$/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "asset-chunks",
              },
            },
          ],
        },
      } as Parameters<typeof VitePWA>[0] & { disable?: boolean }),
    ],
  };
});
