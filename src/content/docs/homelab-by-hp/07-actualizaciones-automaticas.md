---
title: Actualizaciones automáticas
description: Cómo mantener el servidor parcheado automáticamente con unattended-upgrades.
---

Un servidor expuesto (aunque sea solo a través de Tailscale) necesita estar al día con los parches de seguridad. Es fácil olvidarse de ejecutar `apt upgrade` cada semana, así que vamos a dejar que Ubuntu se encargue de instalar las actualizaciones de seguridad por sí solo con **`unattended-upgrades`**.

## Instala el paquete

```bash
sudo apt update
sudo apt install unattended-upgrades apt-listchanges
```

## Habilítalo

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Esto te preguntará si quieres activar las actualizaciones automáticas; selecciona **Sí**. Con esto ya queda configurado el fichero `/etc/apt/apt.conf.d/20auto-upgrades` con las opciones básicas activadas.

## Revisa qué se actualiza automáticamente

Por defecto, `unattended-upgrades` solo instala las actualizaciones de seguridad. Puedes revisar y ajustar esto en:

```bash
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
```

Ahí verás una lista de orígenes (`Unattended-Upgrade::Allowed-Origins`) donde el de seguridad ya viene activado por defecto. Si quieres, también puedes descomentar la línea para reiniciar automáticamente el servidor cuando una actualización lo requiera (por ejemplo, tras una actualización del kernel):

```
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
```

> 💡 Si activas el reinicio automático, elige una hora en la que sepas que no vas a estar usando el servidor.

## Comprueba que está funcionando

Puedes simular una ejecución para ver qué haría sin aplicar cambios:

```bash
sudo unattended-upgrade --dry-run --debug
```

Y consultar el registro de ejecuciones pasadas en:

```bash
cat /var/log/unattended-upgrades/unattended-upgrades.log
```

Con esto, el servidor se mantendrá parcheado frente a vulnerabilidades conocidas sin que tengamos que estar pendientes manualmente.
