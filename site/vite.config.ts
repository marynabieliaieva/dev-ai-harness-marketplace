import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + hash routes: the build works from the GitHub Pages repository subpath
// (https://<owner>.github.io/<repo>/) without server rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { port: 4173 },
});
