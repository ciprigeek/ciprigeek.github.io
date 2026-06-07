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
						{ label: 'Introducción', slug: 'homelab-by-hp/01-intro' },
						{ label: 'Hardware', slug: 'homelab-by-hp/02-hardware' },
						{ label: 'Red y networking', slug: 'homelab-by-hp/03-network' },
							{ label: 'SSH solo con clave', slug: 'homelab-by-hp/04-ssh' },
							{ label: 'Tailscale', slug: 'homelab-by-hp/05-tailscale' },
							{ label: 'Firewall', slug: 'homelab-by-hp/06-firewall' },
					],
				},
			],
		}),
	],
});
