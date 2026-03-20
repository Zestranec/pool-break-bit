import { defineConfig } from 'vite';

// Set VITE_BASE in your environment for GitHub Pages deployment.
// e.g. VITE_BASE=/pool-break-bit/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
