import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { cloudflare } from '@cloudflare/vite-plugin';

/* One Worker serves the web app and its API from the same origin.
   The preview (`--mode demo`) is the web app alone, with sample data and no server. */
export default defineConfig(({ mode }) => mode === 'demo'
  ? { plugins: [solid()], base: './', define: { 'import.meta.env.VITE_DEMO': '"1"' }, build: { outDir: 'dist-demo' } }
  : { plugins: [solid(), cloudflare()] });
