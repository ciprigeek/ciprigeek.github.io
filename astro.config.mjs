// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://ciprigeek.com',
	integrations: [
		starlight({
			title: 'Cipri Geek',
			defaultLocale: 'root',
			locales: {
				root: { label: 'Español', lang: 'es' },
			},
			expressiveCode: {
				themes: ['one-dark-pro', 'github-light'],
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/ciprigeek' },
				{ icon: 'youtube', label: 'YouTube', href: 'https://youtube.com/@ciprigeek' },
			],
			sidebar: [
				{
					label: 'Homelab',
					items: [
						{ label: 'Preparando el servidor #01', slug: 'homelab-by-hp/01-preparando-el-servidor' },
					],
				},
			],
		}),
	],
});
