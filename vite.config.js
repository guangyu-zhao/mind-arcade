import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { generatePages } from './scripts/pages.mjs';
const root = import.meta.dirname;
export default defineConfig(async () => ({
  root: resolve(root, '.generated'),
  base: process.env.SITE_BASE || '/mind-arcade/',
  publicDir: resolve(root, 'public'),
  resolve: { alias: { '/src': resolve(root, 'src') } },
  server: { host: '127.0.0.1', fs: { allow: [root] } },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rolldownOptions: { input: await generatePages() },
  },
  plugins: [
    {
      name: 'mind-arcade-pages',
      configureServer(server) {
        server.watcher.add([resolve(root, 'src'), resolve(root, 'scripts/pages.mjs')]);
        server.watcher.on('change', async (file) => {
          if (file.startsWith(resolve(root, 'src') + '/') && file.endsWith('.html')) {
            await generatePages();
            server.ws.send({ type: 'full-reload' });
          }
        });
      },
    },
  ],
}));
