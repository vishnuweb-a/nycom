import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Surface bundle regressions during development rather than at deploy time.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Keep the rarely-changing vendor core in its own long-cached chunk so
        // feature deploys don't invalidate it for returning shoppers.
        manualChunks: (id) =>
          /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)
            ? 'react-vendor'
            : undefined,
      },
    },
  },
});
