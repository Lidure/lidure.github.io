import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://lidure.github.io',
  integrations: [sitemap()],
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
