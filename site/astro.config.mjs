import { DOMAIN } from './src/config.ts';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: `https://${DOMAIN}`,
  build: { inlineStylesheets: 'always' }, // one less request blocking the first paint
});
