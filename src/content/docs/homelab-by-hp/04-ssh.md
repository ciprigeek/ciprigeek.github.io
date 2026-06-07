---
title: Acceso por SSH solo con clave
description: Cómo asegurar el acceso SSH al servidor mediante claves y desactivar el acceso por contraseña.
---

Antes de empezar a desplegar servicios, lo más importante es asegurarnos de que **solo nosotros podemos acceder al servidor**.

Por defecto, muchos servidores permiten iniciar sesión por SSH usando usuario y contraseña. Esto es cómodo, pero también es la puerta de entrada favorita de los bots que escanean internet buscando contraseñas débiles. Vamos a sustituirlo por autenticación mediante **claves SSH**, mucho más segura.

## Genera un par de claves (en tu ordenador, no en el servidor)

```bash
ssh-keygen -t ed25519 -C "tu_email@ejemplo.com"
```

Esto genera dos ficheros en `~/.ssh/`: una clave privada (`id_ed25519`, que **nunca compartas**) y una pública (`id_ed25519.pub`).

## Copia la clave pública al servidor

```bash
ssh-copy-id usuario@ip_del_servidor
```

Si no tienes `ssh-copy-id` (por ejemplo en Windows), puedes copiar el contenido de tu `id_ed25519.pub` y añadirlo manualmente al final del fichero `~/.ssh/authorized_keys` del servidor.

## Comprueba que puedes entrar sin contraseña

```bash
ssh usuario@ip_del_servidor
```

Si entras sin que te pida contraseña, todo ha ido bien. **No sigas al siguiente paso hasta confirmar esto**, o podrías quedarte fuera del servidor.

## Configura un acceso fácil con `~/.ssh/config`

Para no tener que escribir la IP y el usuario cada vez, podemos crear un alias en el fichero de configuración de SSH de nuestro ordenador. En nuestro caso, el servidor del homelab se llama `experimental` y está en la IP `192.168.188.18`:

```bash
vim ~/.ssh/config
```

Y añadimos:

```
Host experimental
    HostName 192.168.188.18
    User usuario
    IdentityFile ~/.ssh/id_ed25519
```

A partir de ahora, podemos conectarnos simplemente con:

```bash
ssh experimental
```

## Desactiva el acceso por contraseña

Edita la configuración del servidor SSH:

```bash
sudo vim /etc/ssh/sshd_config
```

Y asegúrate de que estas líneas tengan estos valores (descomentándolas si hace falta):

```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

Reinicia el servicio SSH para aplicar los cambios:

```bash
sudo systemctl restart ssh
```

> ⚠️ Mantén abierta tu sesión SSH actual mientras pruebas a abrir una nueva en otra ventana. Así, si algo falla, todavía tienes una sesión activa para corregirlo.

A partir de ahora, nadie podrá entrar al servidor adivinando una contraseña: hace falta tener tu clave privada.
