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
						{ label: 'Introducción', slug: 'homelab/intro' },
						{ label: 'Hardware', slug: 'homelab/hardware' },
						{ label: 'Red y networking', slug: 'homelab/network' },
						{
							label: 'Servicios',
							items: [{ autogenerate: { directory: 'homelab/services' } }],
						},
					],
				},
				{
					label: 'Reviews',
					items: [{ autogenerate: { directory: 'reviews' } }],
				},
				{
					label: 'Blog',
					items: [{ autogenerate: { directory: 'blog' } }],
				},
				{
					label: 'Sobre mí',
					items: [{ label: 'Quién soy', slug: 'about' }],
				},
			],
		}),
	],
});
