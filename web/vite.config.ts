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
    proxy: {
      '/api': backend,
      '/mcp': backend,
      '/uploads': backend,
    },
  },
});
