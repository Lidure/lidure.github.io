import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://lidure.github.io',
  integrations: [sitemap()],
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
});
