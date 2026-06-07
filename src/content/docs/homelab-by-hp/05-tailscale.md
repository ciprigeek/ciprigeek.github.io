---
title: Configurar Tailscale
description: Cómo acceder al homelab desde cualquier lugar sin abrir puertos en el router.
---

[Tailscale](https://tailscale.com/) crea una red privada (basada en WireGuard) entre tus dispositivos, sin necesidad de abrir puertos en el router ni exponer el servidor a internet. Es la forma más sencilla de acceder a tu homelab desde cualquier lugar como si estuvieras en tu red local.

La idea de este homelab es acceder siempre a través de Tailscale, en lugar de exponer servicios directamente a internet.

## Instala Tailscale en el servidor

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

El comando `tailscale up` te dará un enlace para autenticarte con tu cuenta (Google, GitHub, Microsoft, etc.). Ábrelo en el navegador y autoriza el dispositivo.

## Instala Tailscale en tu ordenador o móvil

Descarga el cliente desde [tailscale.com/download](https://tailscale.com/download) e inicia sesión con la misma cuenta. En cuanto lo hagas, ambos dispositivos formarán parte de tu red privada (la llamada *tailnet*).

## Comprueba la IP de Tailscale del servidor

```bash
tailscale ip -4
```

Esa IP (normalmente del rango `100.x.x.x`) es la que usarás para conectarte por SSH desde cualquier sitio, sin depender de tu IP pública ni de redirecciones de puertos:

```bash
ssh usuario@100.x.x.x
```

> 💡 Con Tailscale activo, ya no necesitas exponer el puerto SSH (22) a internet. Esto reduce muchísimo la superficie de ataque del servidor.

Más adelante, cuando empecemos a desplegar servicios (paneles web, dashboards, etc.), también accederemos a ellos a través de la IP de Tailscale, sin necesidad de abrir nada en el router.
