// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://ciprigeek.github.io',
	integrations: [
		starlight({
			title: 'CipriGeek',
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
						{ label: 'Introducción', slug: 'homelab-by-hp/01-intro' },
						{ label: 'Hardware', slug: 'homelab-by-hp/02-hardware' },
						{ label: 'Red y networking', slug: 'homelab-by-hp/network' },
					],
				},
			],
		}),
	],
});
