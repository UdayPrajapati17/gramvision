import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server is bound to the loopback address: GramVision is meant to run on
// your own machine, not to be served to the network.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
