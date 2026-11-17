import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev ports differ from v1's (5173/8000) so both can run side by side.
const backend = `http://localhost:${process.env.DEV_API_PORT ?? 8787}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.DEV_WEB_PORT ?? 5180),
    strictPort: true,
    // Keep the browser's Host header (changeOrigin: false) so the server's
    // same-origin check sees localhost:5180 on both sides.
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/mcp': { target: backend, changeOrigin: false },
      '/uploads': { target: backend, changeOrigin: false },
    },
  },
});
