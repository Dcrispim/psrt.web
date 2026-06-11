import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
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
  },
  publicDir: 'public',
});
