import { DOMAIN } from './src/config.ts';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: `https://${DOMAIN}`,
  build: { inlineStylesheets: 'auto' },
});
