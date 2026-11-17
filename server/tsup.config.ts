import { defineConfig } from 'tsup';

// One bundled file for production. The shared workspace package is inlined;
// npm dependencies (including native ones like better-sqlite3) stay external
// and are installed in the image.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@wecooked/shared'],
});
