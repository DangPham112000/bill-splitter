import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Same-origin /graphql in dev too, matching the nginx proxy in production.
    proxy: {
      '/graphql': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
