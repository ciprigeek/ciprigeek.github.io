---
title: "Docker y tu primer servicio: Nextcloud — Tu primer HomeLab (powered by HP) #02"
description: Instala Docker en Ubuntu Server, organiza tus servicios en carpetas y despliega Nextcloud con acceso remoto seguro vía Tailscale, con subdominio propio y HTTPS automático.
---

## Recordando el episodio anterior
En el [episodio 1](/homelab-by-hp/01-preparando-el-servidor/) dejamos el servidor listo: Ubuntu Server instalado, IP estática, acceso SSH solo con clave, Tailscale conectado a nuestra tailnet, firewall activo con UFW y actualizaciones automáticas de seguridad.

Con esa base ya podemos empezar a desplegar servicios de verdad. En este episodio instalamos Docker, montamos la estructura de carpetas que vamos a usar durante toda la serie, y desplegamos nuestro primer servicio: **Nextcloud**, con acceso remoto seguro y su propio subdominio gracias a Tailscale.

---

## Por qué Docker
Podríamos instalar cada servicio directamente sobre Ubuntu Server, pero eso significa gestionar dependencias, versiones de PHP, bases de datos y configuraciones a mano para cada uno — y si algo se rompe, se rompe todo el sistema.

Docker empaqueta cada servicio con exactamente lo que necesita para funcionar, aislado del resto. Si Nextcloud necesita una versión concreta de PHP y otro servicio necesita otra distinta, no hay conflicto: cada uno vive en su propio contenedor. Y si algo sale mal, se destruye el contenedor y se vuelve a levantar en segundos, sin tocar el sistema operativo.

Es, con diferencia, la forma más sencilla y segura de ir añadiendo servicios a un homelab con el tiempo.

---

## Instalar Docker
Usamos el script oficial de instalación, que configura el repositorio de Docker y añade tu usuario al grupo correspondiente:

*Ventana de terminal*

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Cierra la sesión SSH y vuelve a entrar para que el cambio de grupo se aplique:

*Ventana de terminal*

```bash
exit
ssh experimental
```

Comprueba que todo funciona sin necesidad de `sudo`:

*Ventana de terminal*

```bash
docker run hello-world
```

Si ves el mensaje de bienvenida de Docker, todo está listo.

:::tip
`docker compose` (sin guion) ya viene incluido como plugin desde que instalas Docker con el script oficial. No hace falta instalar `docker-compose` por separado.
:::

---

## Estructura de carpetas
A lo largo de la serie vamos a ir añadiendo un servicio detrás de otro. Para que todo quede ordenado desde el principio, creamos una carpeta por servicio dentro de un directorio común:

*Ventana de terminal*

```bash
mkdir -p ~/homelab/nextcloud
cd ~/homelab/nextcloud
```

Cada servicio tendrá su propio `docker-compose.yml`, su `.env` con las variables sensibles, y sus carpetas de datos — todo autocontenido, así que si algún día quieres mover o hacer backup de un solo servicio, es tan sencillo como copiar su carpeta.

---

## Tailscale por servicio: acceso remoto con subdominio propio
En el episodio 1 conectamos el propio servidor a la tailnet. Ahora vamos un paso más allá: cada servicio que despleguemos va a tener **su propio contenedor Tailscale** acoplado, con **su propio nombre y HTTPS automático**. Así, en vez de acceder a `http://experimental:8080`, accederás a algo como `https://nextcloud.tu-tailnet.ts.net` — limpio, con candado válido, y sin recordar puertos.

Este patrón lo repetiremos con cada servicio nuevo de la serie.

### Genera la auth key
Ve a [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys) y pulsa **Generate auth key**:

- Márcala como **Reusable**, así puedes usar la misma para todos los servicios de la serie.
- Déjala con la expiración por defecto (máximo 90 días) — solo se usa una vez, para el primer arranque de cada contenedor. Más abajo desactivamos la caducidad del propio dispositivo, que es lo que realmente importa a largo plazo.

Copia la key generada (empieza por `tskey-auth-`).

### Configura el `.env`
*Ventana de terminal*

```bash
vim .env
```

```bash
PUID=1000
PGID=1000
TZ=Europe/Madrid

DB_ROOT_PASS=cambia_esto
DB_USER_PASS=cambia_esto_tambien
DB_NAME=nextcloud
DB_USER=nextcloud

TS_AUTHKEY=tskey-auth-xxxxxxxxxx
```

:::caution
Cambia `DB_ROOT_PASS` y `DB_USER_PASS` por contraseñas reales. No dejes los valores de ejemplo.
:::

---

## El `docker-compose.yml` de Nextcloud
*Ventana de terminal*

```bash
vim docker-compose.yml
```

```yaml
services:
  ts-nextcloud:
    container_name: nextcloud_tailscale
    image: tailscale/tailscale:latest
    hostname: nextcloud
    restart: unless-stopped
    environment:
      TS_AUTHKEY: ${TS_AUTHKEY}
      TS_STATE_DIR: /var/lib/tailscale
      TS_SERVE_CONFIG: /config/serve.json
    volumes:
      - ./ts-nextcloud:/var/lib/tailscale
      - ./ts-nextcloud-config:/config
    cap_add:
      - NET_ADMIN
      - NET_RAW
    security_opt:
      - no-new-privileges:true

  db:
    container_name: nextcloud_mariadb
    image: lscr.io/linuxserver/mariadb:11.4.9-r0-ls208
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASS}
      MYSQL_PASSWORD: ${DB_USER_PASS}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      PUID: ${PUID}
      PGID: ${PGID}
      TZ: ${TZ}
    volumes:
      - ./db:/config
    networks:
      - nextcloud
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  redis:
    container_name: nextcloud_redis
    image: redis:8.8.0
    restart: unless-stopped
    command: redis-server --save "" --appendonly no
    networks:
      - nextcloud
    tmpfs:
      - /data
    security_opt:
      - no-new-privileges:true

  app:
    container_name: nextcloud_app
    image: lscr.io/linuxserver/nextcloud:32.0.6-ls416
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
      ts-nextcloud:
        condition: service_started
    environment:
      PUID: ${PUID}
      PGID: ${PGID}
      TZ: ${TZ}
    volumes:
      - ./config:/config
      - ./data:/data
    network_mode: service:ts-nextcloud
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "curl", "-k", "-f", "https://localhost:443"]
      interval: 60s
      timeout: 15s
      retries: 3
      start_period: 90s

networks:
  nextcloud:
    name: nextcloud
```

### Por qué `app` usa `network_mode: service:ts-nextcloud`
El contenedor `app` (Nextcloud) comparte la pila de red del contenedor `ts-nextcloud` en lugar de tener la suya propia. Esto es lo que permite que Tailscale exponga directamente el puerto de Nextcloud bajo su propio nombre en la tailnet, sin pasos intermedios.

`db` y `redis`, en cambio, se quedan en la red interna `nextcloud` — no son accesibles desde fuera, ni siquiera desde la tailnet. Solo `app` puede hablar con ellos.

---

## El fichero `serve.json`
Este fichero le dice a Tailscale que exponga el puerto 443 de Nextcloud con HTTPS automático:

*Ventana de terminal*

```bash
mkdir -p ts-nextcloud-config
vim ts-nextcloud-config/serve.json
```

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": {
        "/": {
          "Proxy": "https://127.0.0.1:443"
        }
      }
    }
  }
}
```

---

## Levanta los servicios
*Ventana de terminal*

```bash
docker compose up -d
```

Comprueba que los tres contenedores están corriendo:

*Ventana de terminal*

```bash
docker compose ps
```

Y revisa que Tailscale se ha autenticado correctamente:

*Ventana de terminal*

```bash
docker compose logs ts-nextcloud
```

---

## Desactiva la caducidad del dispositivo
La auth key que generaste caduca a los 90 días, pero eso no es un problema: solo se usa una vez, en el primer arranque. Lo que sí importa es que el **dispositivo** en sí no te pida reautenticación cada 180 días — algo especialmente molesto en un servicio que no quieres tener que estar vigilando.

Ve a [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines), busca el dispositivo `nextcloud` que acaba de aparecer, abre el menú **···** y selecciona **Disable key expiry**.

Repite este paso con cada nuevo servicio que despleguemos en la serie.

---

## Accede a Nextcloud
Abre en el navegador:

```
https://nextcloud.tu-tailnet.ts.net
```

:::tip
Sustituye `tu-tailnet` por el nombre real de tu tailnet, que puedes consultar en [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns).
:::

Verás el asistente inicial de Nextcloud. Crea tu usuario administrador y ya tienes tu primer servicio del homelab funcionando, accesible de forma segura desde cualquier dispositivo conectado a tu tailnet — el móvil, el portátil o el ordenador del trabajo — sin haber abierto un solo puerto en el router.

---

## Qué hemos conseguido
- Docker instalado y funcionando en el servidor.
- Una estructura de carpetas ordenada para ir añadiendo servicios.
- Nextcloud desplegado con base de datos y caché propios.
- Acceso remoto seguro con HTTPS automático y subdominio propio, sin exponer nada a internet.

En el próximo episodio seguimos ampliando el homelab con un nuevo servicio, siguiendo exactamente este mismo patrón de carpeta + Tailscale sidecar.