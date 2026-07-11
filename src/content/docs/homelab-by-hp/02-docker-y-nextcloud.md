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
    networks:
      - nextcloud
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
      nextcloud:
        ipv4_address: 172.28.1.10
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
      nextcloud:
        ipv4_address: 172.28.1.11
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
    ipam:
      config:
        - subnet: 172.28.1.0/24
```

### Por qué `app` usa `network_mode: service:ts-nextcloud`
El contenedor `app` (Nextcloud) comparte la pila de red del contenedor `ts-nextcloud` en lugar de tener la suya propia. Esto es lo que permite que Tailscale exponga directamente el puerto de Nextcloud bajo su propio nombre en la tailnet, sin pasos intermedios.

`db` y `redis` se quedan en la red interna `nextcloud`, cada uno con una **IP fija** (`172.28.1.10` y `172.28.1.11`) — no son accesibles desde fuera, ni siquiera desde la tailnet. `ts-nextcloud` también está metido en esa misma red `nextcloud`, así que `app`, al viajar dentro de su namespace, tiene ruta hasta esas IPs directamente. No usamos nombres de host para conectar a la base de datos, sino la IP fija — ver el aviso siguiente para el porqué.

:::caution
Este patrón tiene varias trampas típicas la primera vez que lo montas, todas relacionadas con que `app` no gestiona su propia red:

**1. Si `ts-nextcloud` no está en la red `nextcloud`**, `app` no tendrá ni siquiera ruta hasta `db` y `redis`.

**2. Docker no permite usar `dns:` en un servicio con `network_mode: service:...`** — da el error `conflicting options: dns and the network mode`.

**3. Docker tampoco permite `extra_hosts:` en ese mismo escenario** — da el error `conflicting options: custom host-to-IP mapping and the network mode`.

Como cualquier opción de red propia en `app` entra en conflicto con `network_mode: service:...`, la solución más simple y robusta es **no depender de resolución de nombres en absoluto**: le damos IP fija a `db` y `redis` en la red (`ipv4_address`), y en el instalador de Nextcloud usamos esa IP directamente en vez del nombre `db`.
:::

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
    "nextcloud.tu-tailnet.ts.net:443": {
      "Handlers": {
        "/": {
          "Proxy": "https+insecure://127.0.0.1:443"
        }
      }
    }
  }
}
```

:::caution
Sustituye `nextcloud.tu-tailnet.ts.net` por tu dominio real (lo ves en `login.tailscale.com/admin/dns`). Docker Compose **no** sustituye variables de entorno dentro de ficheros de configuración como este, así que hay que escribir el nombre completo a mano.

Usamos `https+insecure://` y no `https://` porque Nextcloud sirve su propio certificado autofirmado en el puerto 443. Con `https://` a secas, Tailscale intenta verificar ese certificado, falla, y el resultado es un **502** al acceder. `https+insecure://` le dice a Tailscale que confíe en ese salto interno sin verificar el certificado — el tráfico entre tu navegador y Tailscale sigue yendo con HTTPS válido de Let's Encrypt en todo momento.
:::

:::caution
**Nunca reinicies solo el contenedor `ts-nextcloud`.** Como `app` comparte su red con `network_mode: service:ts-nextcloud`, reiniciar únicamente el sidecar destruye el namespace de red del que depende Nextcloud, y el servicio deja de responder — incluso por IP directa — hasta que también reinicies `app`.

Si necesitas reiniciar el sidecar de Tailscale (por ejemplo, tras cambiar el `serve.json`), reinicia siempre los dos juntos:

*Ventana de terminal*

```bash
docker compose stop app ts-nextcloud
docker compose up -d ts-nextcloud app
```

:::

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

Verás el asistente inicial de Nextcloud. Crea tu usuario administrador y, cuando te pida los datos de la base de datos, usa estos:

Campo
Valor

Base de datos
MySQL/MariaDB

Usuario de la base de datos
el valor de `DB_USER` en tu `.env` (`nextcloud`)

Contraseña de la base de datos
el valor de `DB_USER_PASS` en tu `.env`

Nombre de la base de datos
el valor de `DB_NAME` en tu `.env` (`nextcloud`)

Host de la base de datos
`172.28.1.10:3306`

El host es la IP fija que le dimos a `db` en el `docker-compose.yml`, con el puerto por defecto de MySQL. No usamos el nombre `db` porque, como vimos más arriba, `app` no puede resolver nombres de host en este modo de red — solo tiene ruta directa a las IPs.

Y ya tienes tu primer servicio del homelab funcionando, accesible de forma segura desde cualquier dispositivo conectado a tu tailnet — el móvil, el portátil o el ordenador del trabajo — sin haber abierto un solo puerto en el router.

---

## Activa Redis para caché y bloqueo de ficheros
Tenemos el contenedor `redis` desplegado desde el principio, pero Nextcloud no lo usa todavía — hay que decírselo explícitamente. A diferencia de la imagen oficial de Nextcloud, que se autoconfigura con una variable de entorno, la imagen de **linuxserver** que usamos en este tutorial no aplica esa autoconfiguración: hay que editar `config.php` a mano.

*Ventana de terminal*

```bash
docker compose exec app vim /config/www/nextcloud/config/config.php
```

Dentro del array `$CONFIG`, añade:

```php
'memcache.local' => '\OC\Memcache\Redis',
'memcache.locking' => '\OC\Memcache\Redis',
'redis' => array (
    'host' => '172.28.1.11',
    'port' => 6379,
),
```

Usamos la IP fija de `redis` (`172.28.1.11`) por el mismo motivo que con `db`: `app` no resuelve nombres de host en este modo de red.

Guarda y reinicia únicamente `app` para que recargue la configuración:

*Ventana de terminal*

```bash
docker compose restart app
```

:::tip
Comprueba que ha quedado bien aplicado entrando en **Ajustes → Administración → Resumen** dentro de Nextcloud. Si sigue habiendo un aviso sobre el memcache, revisa que no haya un error de sintaxis en el `config.php` — un error ahí puede dejar Nextcloud inaccesible hasta corregirlo.
:::

---

## Qué hemos conseguido
- Docker instalado y funcionando en el servidor.
- Una estructura de carpetas ordenada para ir añadiendo servicios.
- Nextcloud desplegado con base de datos y caché Redis propios.
- Acceso remoto seguro con HTTPS automático y subdominio propio, sin exponer nada a internet.

En el próximo episodio seguimos ampliando el homelab con un nuevo servicio, siguiendo exactamente este mismo patrón de carpeta + Tailscale sidecar.