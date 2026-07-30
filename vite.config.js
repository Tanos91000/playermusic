import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  // main.js charge http://127.0.0.1:3005 en dev : sans port fixe, Electron
  // ne trouvait pas Vite et retombait sur le dist/ (build figé).
  server: {
    host: '127.0.0.1',
    port: 3005,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});