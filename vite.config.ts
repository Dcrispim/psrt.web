import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repoBase = '/';
const base = process.env.GITHUB_PAGES === 'true' ? repoBase : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{css,html,svg,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.endsWith('.js'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-scripts',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ['@psrt/sdk'],
    alias: {
      '@wails/go/main/GUIApp': path.resolve(__dirname, 'src/api/connectorClient.ts'),
      '@wails/go/models': path.resolve(__dirname, 'src/models/models.ts'),
      '@wails/runtime/runtime': path.resolve(__dirname, 'src/runtime.ts'),
      '@wails/runtime': path.resolve(__dirname, 'src/runtime.ts'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  publicDir: 'public',
});
