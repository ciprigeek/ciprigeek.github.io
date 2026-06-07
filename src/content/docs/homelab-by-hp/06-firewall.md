---
title: Activar el firewall
description: Cómo proteger el servidor con UFW, bloqueando todo el tráfico que no necesitamos.
---

Ubuntu Server incluye **UFW** (Uncomplicated Firewall), una capa sencilla sobre `iptables` que nos permite definir qué tráfico se permite y cuál se bloquea.

La idea es bloquear todo por defecto y abrir solo lo estrictamente necesario.

## Permite el tráfico de Tailscale y SSH

```bash
sudo ufw allow in on tailscale0
sudo ufw allow 22/tcp
```

> Mantenemos el puerto 22 abierto para la red local mientras configuramos todo; más adelante, si solo vas a entrar por Tailscale, puedes restringirlo o incluso cerrarlo a la red local.

## Define las políticas por defecto

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

Esto significa: **rechaza cualquier conexión entrante que no hayas permitido explícitamente**, pero deja que el servidor pueda iniciar conexiones hacia fuera (actualizaciones, descargas, etc.).

## Activa el firewall

```bash
sudo ufw enable
```

## Comprueba el estado y las reglas activas

```bash
sudo ufw status verbose
```

A medida que vayamos desplegando servicios (un panel web, una base de datos, etc.), iremos añadiendo reglas puntuales con `sudo ufw allow <puerto>/tcp`, siempre con cuidado de abrir solo lo que realmente necesitamos exponer.

Con SSH solo por clave, Tailscale y el firewall activo, ya tenemos una base segura sobre la que empezar a desplegar servicios.
