---
title: "Preparando el servidor — Tu primer HomeLab (powered by HP) #01"
description: Por qué montar un homelab, qué hardware necesitas, cómo configurar la red, SSH, Tailscale, el firewall y las actualizaciones automáticas.
---

## ¿Por qué un homelab?

Hoy en día, los precios de las cosas en la nube son caros. Además, los datos están fuera de mi control y aprender a administrar un servidor es una habilidad valiosa. Por eso, decidí montar mi propio homelab en casa.

Y aunque yo tengo uno un poco más depurado, con este tutorial quiero que empecéis por lo básico e iremos extendiendo el homelab poco a poco, añadiendo servicios y funcionalidades nuevas. La idea es que sea un proyecto de aprendizaje continuo, donde podamos experimentar y aprender juntos.

---

## Hardware

Para empezar podeis usar un pc viejo que tengáis por casa, o incluso comprar uno de segunda mano. Lo importante es que tenga suficiente potencia para correr los servicios que queréis montar y que tenga capacidad de almacenamiento suficiente para vuestros datos.

En este caso HP me cedió algo que tenía por el almacen pero no tiene por que ser lo mismo.

El equipo usado es un **Victus by HP 15L Gaming Desktop TG02-0041ns PC** (número de producto 656W9EA), con las siguientes especificaciones de fábrica:

- **Procesador**: Intel® Core™ i5-12400F (frecuencia base de 2,5 GHz, hasta 4,4 GHz con Intel® Turbo Boost, 18 MB de caché L3, 6 núcleos, 12 subprocesos)
- **Placa base**: Reno2
- **Memoria**: 16 GB DDR4-3200 MHz (1 x 16 GB)
- **Almacenamiento**: SSD de 1 TB PCIe® NVMe™ M.2
- **Gráficos**: NVIDIA® GeForce® GTX 1650 (GDDR6 de 4 GB dedicada)
- **Puertos**: 1 USB-C SuperSpeed 5Gbps; 2 USB-A SuperSpeed 10Gbps; 2 USB-A SuperSpeed 5Gbps; 1 combo de auriculares y micrófono
- **Ranuras de ampliación**: 2 M.2 (1 para SSD, 1 para WLAN); 1 PCIe x16; 1 PCIe x1
- **Red**: LAN 10/100/1000 GbE integrada
- **Inalámbrico**: Combo Realtek Wi-Fi 6 (2x2) y Bluetooth® 5.2
- **Dimensiones**: 15,5 x 29,73 x 33,7 cm
- **Peso**: 6,31 kg
- **Fuente de alimentación**: 350 W con certificación 80 Plus Gold
- **Sistema operativo de fábrica**: Windows 11 Home

### Cambios realizados

Sobre esta configuración de fábrica he hecho los siguientes cambios:

- He sustituido el SSD NVMe original de 1 TB por un **Samsung 970 EVO de 256 GB**.
- He añadido un disco **Toshiba N300 de 6 TB** para almacenamiento adicional.

---

## Red y Networking

En Ubuntu Server, la red se gestiona con **Netplan**, el sistema por defecto desde la versión 18.04. Así es como hemos fijado la IP del equipo del homelab.

### 1. Identifica la interfaz de red

```bash
ip link show
# o
ip a
```

Busca el nombre de tu interfaz (por ejemplo `eth0`, `ens33`, `enp0s3`).

### 2. Edita el fichero de Netplan

```bash
sudo vim /etc/netplan/00-installer-config.yaml
# el nombre exacto puede variar, lista los ficheros con: ls /etc/netplan/
```

### 3. Configura la IP estática

Sustituye el contenido por algo así, adaptando la interfaz, la IP y el gateway a tu red:

```yaml
network:
  version: 2
  ethernets:
    ens33:                          # ← tu interfaz
      dhcp4: false
      addresses:
        - 192.168.1.100/24          # ← tu IP y máscara
      routes:
        - to: default
          via: 192.168.1.1          # ← tu gateway
      nameservers:
        addresses:
          - 8.8.8.8
          - 1.1.1.1
```

### 4. Aplica los cambios

```bash
sudo netplan try        # prueba durante 120s (revierte si no confirmas)
# si todo va bien:
sudo netplan apply
```

### 5. Verifica

```bash
ip a show ens33
ip route
```

### Notas rápidas

- `netplan try` es tu red de seguridad: si pierdes la conexión SSH, revierte solo al cabo de 120 segundos.
- El fichero YAML es muy sensible a la indentación — usa siempre espacios, nunca tabs.
- Si tienes varias interfaces, añade cada una bajo `ethernets:` al mismo nivel.
- Para servidores del homelab también puedes fijar la IP desde el router por MAC (DHCP estático) sin tocar el sistema operativo — en algunos escenarios es más limpio.

---

## Acceso por SSH solo con clave

Antes de empezar a desplegar servicios, lo más importante es asegurarnos de que **solo nosotros podemos acceder al servidor**.

Por defecto, muchos servidores permiten iniciar sesión por SSH usando usuario y contraseña. Esto es cómodo, pero también es la puerta de entrada favorita de los bots que escanean internet buscando contraseñas débiles. Vamos a sustituirlo por autenticación mediante **claves SSH**, mucho más segura.

### Genera un par de claves (en tu ordenador, no en el servidor)

```bash
ssh-keygen -t ed25519 -C "tu_email@ejemplo.com"
```

Esto genera dos ficheros en `~/.ssh/`: una clave privada (`id_ed25519`, que **nunca compartas**) y una pública (`id_ed25519.pub`).

### Copia la clave pública al servidor

```bash
ssh-copy-id usuario@ip_del_servidor
```

Si no tienes `ssh-copy-id` (por ejemplo en Windows), puedes copiar el contenido de tu `id_ed25519.pub` y añadirlo manualmente al final del fichero `~/.ssh/authorized_keys` del servidor.

### Comprueba que puedes entrar sin contraseña

```bash
ssh usuario@ip_del_servidor
```

Si entras sin que te pida contraseña, todo ha ido bien. **No sigas al siguiente paso hasta confirmar esto**, o podrías quedarte fuera del servidor.

### Configura un acceso fácil con `~/.ssh/config`

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

### Desactiva el acceso por contraseña

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

**En Ubuntu Server 26.04 LTS (y versiones recientes con cloud-init)** hay un fichero adicional que sobreescribe esta configuración. Comprueba si existe:

```bash
cat /etc/ssh/sshd_config.d/50-cloud-init.conf
```

Si ves `PasswordAuthentication yes`, edítalo también:

```bash
sudo vim /etc/ssh/sshd_config.d/50-cloud-init.conf
```

Y cambia la línea a:

```
PasswordAuthentication no
```

Reinicia el servicio SSH para aplicar los cambios:

```bash
sudo systemctl restart ssh
```

> ⚠️ Mantén abierta tu sesión SSH actual mientras pruebas a abrir una nueva en otra ventana. Así, si algo falla, todavía tienes una sesión activa para corregirlo.

A partir de ahora, nadie podrá entrar al servidor adivinando una contraseña: hace falta tener tu clave privada.

---

## Configurar Tailscale

[Tailscale](https://tailscale.com/) crea una red privada (basada en WireGuard) entre tus dispositivos, sin necesidad de abrir puertos en el router ni exponer el servidor a internet. Es la forma más sencilla de acceder a tu homelab desde cualquier lugar como si estuvieras en tu red local.

La idea de este homelab es acceder siempre a través de Tailscale, en lugar de exponer servicios directamente a internet.

### Instala Tailscale en el servidor

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

El comando `tailscale up` te dará un enlace para autenticarte con tu cuenta (Google, GitHub, Microsoft, etc.). Ábrelo en el navegador y autoriza el dispositivo.

### Instala Tailscale en tu ordenador o móvil

Descarga el cliente desde [tailscale.com/download](https://tailscale.com/download) e inicia sesión con la misma cuenta. En cuanto lo hagas, ambos dispositivos formarán parte de tu red privada (la llamada *tailnet*).

### Comprueba la IP de Tailscale del servidor

```bash
tailscale ip -4
```

Esa IP (normalmente del rango `100.x.x.x`) es la que usarás para conectarte por SSH desde cualquier sitio, sin depender de tu IP pública ni de redirecciones de puertos:

```bash
ssh usuario@100.x.x.x
```

> 💡 Con Tailscale activo, ya no necesitas exponer el puerto SSH (22) a internet. Esto reduce muchísimo la superficie de ataque del servidor.

Más adelante, cuando empecemos a desplegar servicios (paneles web, dashboards, etc.), también accederemos a ellos a través de la IP de Tailscale, sin necesidad de abrir nada en el router.

---

## Activar el firewall

Ubuntu Server incluye **UFW** (Uncomplicated Firewall), una capa sencilla sobre `iptables` que nos permite definir qué tráfico se permite y cuál se bloquea.

La idea es bloquear todo por defecto y abrir solo lo estrictamente necesario.

### Permite el tráfico de Tailscale y SSH

```bash
sudo ufw allow in on tailscale0
sudo ufw allow 22/tcp
```

> Mantenemos el puerto 22 abierto para la red local mientras configuramos todo; más adelante, si solo vas a entrar por Tailscale, puedes restringirlo o incluso cerrarlo a la red local.

### Define las políticas por defecto

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

Esto significa: **rechaza cualquier conexión entrante que no hayas permitido explícitamente**, pero deja que el servidor pueda iniciar conexiones hacia fuera (actualizaciones, descargas, etc.).

### Activa el firewall

```bash
sudo ufw enable
```

### Comprueba el estado y las reglas activas

```bash
sudo ufw status verbose
```

A medida que vayamos desplegando servicios (un panel web, una base de datos, etc.), iremos añadiendo reglas puntuales con `sudo ufw allow <puerto>/tcp`, siempre con cuidado de abrir solo lo que realmente necesitamos exponer.

Con SSH solo por clave, Tailscale y el firewall activo, ya tenemos una base segura sobre la que empezar a desplegar servicios.

---

## Actualizaciones automáticas

Un servidor expuesto (aunque sea solo a través de Tailscale) necesita estar al día con los parches de seguridad. Es fácil olvidarse de ejecutar `apt upgrade` cada semana, así que vamos a dejar que Ubuntu se encargue de instalar las actualizaciones de seguridad por sí solo con **`unattended-upgrades`**.

### Instala el paquete

```bash
sudo apt update
sudo apt install unattended-upgrades apt-listchanges
```

### Habilítalo

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Esto te preguntará si quieres activar las actualizaciones automáticas; selecciona **Sí**. Con esto ya queda configurado el fichero `/etc/apt/apt.conf.d/20auto-upgrades` con las opciones básicas activadas.

### Revisa qué se actualiza automáticamente

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

### Comprueba que está funcionando

Puedes simular una ejecución para ver qué haría sin aplicar cambios:

```bash
sudo unattended-upgrade --dry-run --debug
```

Y consultar el registro de ejecuciones pasadas en:

```bash
cat /var/log/unattended-upgrades/unattended-upgrades.log
```

Con esto, el servidor se mantendrá parcheado frente a vulnerabilidades conocidas sin que tengamos que estar pendientes manualmente.
