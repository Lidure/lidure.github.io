import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://lidure.github.io',
  integrations: [sitemap()],
  output: 'server',
  adapter: vercel(),
});
