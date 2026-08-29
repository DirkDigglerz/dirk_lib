import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Serve another resource's built files, in dev only.
 *
 * A script can ship its own React component for the panel to render, loaded
 * in game from `nui://<resource>/<path>`. A browser has no such scheme, so in
 * dev those pages could not be opened at all - which meant they could not be
 * looked at, worked on, or screenshotted for the docs.
 *
 * Resources are siblings of dirk_lib on disk, so the file is simply read from
 * there. Dev only: the real panel uses nui:// and never touches this.
 */
function serveSiblingResources(): Plugin {
  const ROOT = path.resolve(__dirname, '..', '..');
  return {
    name: 'dirk-serve-sibling-resources',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith('/__nui/')) return next();

        const rel = decodeURIComponent(url.slice('/__nui/'.length));
        // No climbing out of the resources folder.
        const file = path.resolve(ROOT, rel);
        if (!file.startsWith(ROOT) || !existsSync(file)) {
          res.statusCode = 404;
          res.end(`not found: ${rel}`);
          return;
        }

        res.setHeader('Content-Type', file.endsWith('.js')
          ? 'text/javascript' : 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveSiblingResources()],
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
