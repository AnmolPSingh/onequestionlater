import { DOMAIN } from './src/config.ts';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: `https://${DOMAIN}`,
  redirects: { '/about': '/story' }, // the page's first name, so old links still land
  build: { inlineStylesheets: 'always' }, // one less request blocking the first paint
});
