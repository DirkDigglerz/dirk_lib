import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
  },
  server: {
    // Needed so the dev server accepts the tunnel's Host header when the panel
    // is previewed from another machine. Dev only - never used by the build.
    host: true,
    allowedHosts: true,
    watch: {
      // `pnpm build` rewrites this directory, and the dev server watching its
      // own output means a build run alongside it dies on a file that was
      // deleted between the change event and the read.
      ignored: ['**/build/**'],
    },
  },
});
