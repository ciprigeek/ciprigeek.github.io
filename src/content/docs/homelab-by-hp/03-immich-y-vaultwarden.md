---
title: "Fotos y contraseñas: Immich y Vaultwarden — Tu primer HomeLab (powered by HP) #03"
description: Despliega Immich como alternativa autoalojada a Google Fotos y Vaultwarden como gestor de contraseñas, cada uno con su propio subdominio y HTTPS automático vía Tailscale. Cierra el episodio con Watchtower avisándote de actualizaciones disponibles.
---

## Recordando el episodio anterior

En el [episodio 2](/homelab-by-hp/02-docker-y-nextcloud/) instalamos Docker, montamos la estructura de carpetas de la serie y desplegamos Nextcloud siguiendo un patrón que vamos a repetir en este episodio: cada servicio vive en su propia carpeta, con un contenedor Tailscale como sidecar que le da HTTPS automático y un subdominio propio dentro de tu tailnet.

En este episodio cerramos la serie (por ahora) con dos servicios muy demandados en cualquier homelab: **Vaultwarden**, un gestor de contraseñas autoalojado compatible con Bitwarden, y **Immich**, una alternativa a Google Fotos con reconocimiento facial y búsqueda inteligente.

Empezamos por Vaultwarden, que es mucho más sencillo, y dejamos Immich para el final.

---

## Vaultwarden

Vaultwarden es un único contenedor. No necesita una base de datos externa — usa SQLite internamente — así que es el despliegue más simple de toda la serie.

### Estructura de carpeta

*Ventana de terminal*

```bash
mkdir -p ~/homelab/vaultwarden
cd ~/homelab/vaultwarden
```

### Genera la auth key de Tailscale

Igual que en el episodio 2: ve a [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys), pulsa **Generate auth key**, márcala como **Reusable** y cópiala.

### El `.env`

*Ventana de terminal*

```bash
vim .env
```

```bash
TZ=Europe/Madrid
TS_AUTHKEY=tskey-auth-xxxxxxxxxx
```

### El `docker-compose.yml`

*Ventana de terminal*

```bash
vim docker-compose.yml
```

```yaml
services:
  ts-vaultwarden:
    container_name: vaultwarden_tailscale
    image: tailscale/tailscale:latest
    hostname: vaultwarden
    restart: unless-stopped
    environment:
      TS_AUTHKEY: ${TS_AUTHKEY}
      TS_STATE_DIR: /var/lib/tailscale
      TS_SERVE_CONFIG: /config/serve.json
    volumes:
      - ./ts-vaultwarden:/var/lib/tailscale
      - ./ts-vaultwarden-config:/config
    cap_add:
      - NET_ADMIN
      - NET_RAW
    security_opt:
      - no-new-privileges:true

  app:
    container_name: vaultwarden_app
    image: vaultwarden/server:latest
    restart: unless-stopped
    depends_on:
      ts-vaultwarden:
        condition: service_started
    environment:
      TZ: ${TZ}
      SIGNUPS_ALLOWED: "false"
    volumes:
      - ./data:/data
    network_mode: service:ts-vaultwarden
    security_opt:
      - no-new-privileges:true
```

Como en Nextcloud, `app` comparte la red de `ts-vaultwarden` en vez de tener la suya propia — así Tailscale puede exponerlo directamente bajo su propio nombre en la tailnet.

:::caution
Como ya vimos en el episodio 2, nunca reinicies solo el contenedor del sidecar (`ts-vaultwarden`) — reinicia siempre los dos juntos con `docker compose stop app ts-vaultwarden && docker compose up -d ts-vaultwarden app`, o `app` se quedará sin red.
:::

### El fichero `serve.json`

Vaultwarden sirve HTTP plano en el puerto 80 internamente — a diferencia de Nextcloud, no necesitamos `https+insecure://`, con `http://` es suficiente.

*Ventana de terminal*

```bash
mkdir -p ts-vaultwarden-config
vim ts-vaultwarden-config/serve.json
```

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "vaultwarden.tu-tailnet.ts.net:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://127.0.0.1:80"
        }
      }
    }
  }
}
```

:::caution
Sustituye `vaultwarden.tu-tailnet.ts.net` por tu dominio real de tailnet — Docker Compose no sustituye variables dentro de este fichero, hay que escribirlo a mano.
:::

### Levanta el servicio

*Ventana de terminal*

```bash
docker compose up -d
```

### Crea tu cuenta y cierra el registro

Accede a `https://vaultwarden.tu-tailnet.ts.net` y crea tu cuenta de administrador. En cuanto la tengas creada, cierra el registro para que nadie más pueda darse de alta:

*Ventana de terminal*

```bash
vim .env
```

Cambia `SIGNUPS_ALLOWED` a `"false"` (si ya estaba así, confirma que sigue estándolo) y reinicia:

```bash
docker compose up -d app
```

:::tip
No olvides desactivar la caducidad del dispositivo en [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines) → dispositivo `vaultwarden` → **···** → **Disable key expiry**, tal y como hicimos con Nextcloud en el episodio 2.
:::

---

## Immich

Immich necesita bastante más músculo que los servicios anteriores.

:::caution
**Requisitos mínimos: 6GB de RAM y 2 CPUs. Recomendado: 8GB y 4 CPUs.** Si tu HP mini va justo de recursos, el servicio de machine learning (reconocimiento facial, búsqueda inteligente) es el que más nota la falta de potencia. Merece la pena comprobar los recursos disponibles antes de arrancar.
:::

Son cuatro contenedores: `database` (PostgreSQL con extensión vectorial VectorChord), `redis`, `immich-machine-learning` e `immich-server`.

### Estructura de carpeta

*Ventana de terminal*

```bash
mkdir -p ~/homelab/immich
cd ~/homelab/immich
```

### Genera la auth key de Tailscale

Mismo proceso que con los servicios anteriores en [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys).

### El `.env`

*Ventana de terminal*

```bash
vim .env
```

```bash
TZ=Europe/Madrid

UPLOAD_LOCATION=./library
DB_DATA_LOCATION=./postgres

DB_PASSWORD=cambia_esto
DB_USERNAME=postgres
DB_DATABASE_NAME=immich

# IPs fijas de la red interna — imprescindibles porque immich-server
# comparte red con el sidecar de Tailscale y no puede resolver nombres
DB_HOSTNAME=172.28.2.10
REDIS_HOSTNAME=172.28.2.11

IMMICH_VERSION=release

TS_AUTHKEY=tskey-auth-xxxxxxxxxx
```

### El `docker-compose.yml`

*Ventana de terminal*

```bash
vim docker-compose.yml
```

```yaml
services:
  ts-immich:
    container_name: immich_tailscale
    image: tailscale/tailscale:latest
    hostname: immich
    restart: unless-stopped
    environment:
      TS_AUTHKEY: ${TS_AUTHKEY}
      TS_STATE_DIR: /var/lib/tailscale
      TS_SERVE_CONFIG: /config/serve.json
    volumes:
      - ./ts-immich:/var/lib/tailscale
      - ./ts-immich-config:/config
    networks:
      - immich
    cap_add:
      - NET_ADMIN
      - NET_RAW
    security_opt:
      - no-new-privileges:true

  database:
    container_name: immich_postgres
    image: ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_DB: ${DB_DATABASE_NAME}
      POSTGRES_INITDB_ARGS: '--data-checksums'
    volumes:
      - ${DB_DATA_LOCATION}:/var/lib/postgresql/data
    shm_size: 128mb
    networks:
      immich:
        ipv4_address: 172.28.2.10
    security_opt:
      - no-new-privileges:true

  redis:
    container_name: immich_redis
    image: docker.io/valkey/valkey:9
    restart: unless-stopped
    networks:
      immich:
        ipv4_address: 172.28.2.11
    security_opt:
      - no-new-privileges:true

  immich-machine-learning:
    container_name: immich_machine_learning
    image: ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION:-release}
    restart: unless-stopped
    volumes:
      - model-cache:/cache
    environment:
      DB_HOSTNAME: database
      REDIS_HOSTNAME: redis
    networks:
      - immich
    security_opt:
      - no-new-privileges:true

  immich-server:
    container_name: immich_server
    image: ghcr.io/immich-app/immich-server:${IMMICH_VERSION:-release}
    restart: unless-stopped
    depends_on:
      - database
      - redis
      - ts-immich
    volumes:
      - ${UPLOAD_LOCATION}:/data
      - /etc/localtime:/etc/localtime:ro
    env_file:
      - .env
    network_mode: service:ts-immich
    security_opt:
      - no-new-privileges:true

networks:
  immich:
    name: immich
    ipam:
      config:
        - subnet: 172.28.2.0/24

volumes:
  model-cache:
```

### Por qué `immich-machine-learning` no necesita IP fija y `immich-server` sí

`immich-machine-learning` está conectado **directamente** a la red `immich`, así que resuelve `database` y `redis` por nombre sin ningún problema, igual que cualquier contenedor normal.

`immich-server`, en cambio, usa `network_mode: service:ts-immich` para compartir la red del sidecar de Tailscale y así poder exponerse con HTTPS y subdominio propio. Pero eso significa que **no tiene red propia**, y como vimos con Nextcloud en el episodio 2, un contenedor en esa situación no puede resolver nombres de host — ni con `dns:`, ni con `extra_hosts:` (Docker no permite ninguna de las dos opciones combinadas con `network_mode: service:...`). Por eso `DB_HOSTNAME` y `REDIS_HOSTNAME` en el `.env` son las **IPs fijas**, no los nombres `database`/`redis`.

:::caution
Igual que con Nextcloud: si alguna vez necesitas reiniciar `ts-immich`, reinicia siempre `immich-server` a la vez (`docker compose stop immich-server ts-immich && docker compose up -d ts-immich immich-server`), o se quedará sin red.
:::

### El fichero `serve.json`

Immich sirve HTTP plano en el puerto 2283 — como con Vaultwarden, no hace falta `https+insecure://`.

*Ventana de terminal*

```bash
mkdir -p ts-immich-config
vim ts-immich-config/serve.json
```

```json
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "immich.tu-tailnet.ts.net:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://127.0.0.1:2283"
        }
      }
    }
  }
}
```

### Levanta los servicios

*Ventana de terminal*

```bash
docker compose up -d
```

La primera vez puede tardar un poco: `database` tiene que inicializar la extensión vectorial y `immich-machine-learning` descarga sus modelos. Comprueba el estado:

*Ventana de terminal*

```bash
docker compose ps
docker compose logs -f immich-server
```

### Accede a Immich

Abre `https://immich.tu-tailnet.ts.net` y sigue el asistente para crear tu usuario administrador.

:::tip
Si tu servidor tiene una GPU NVIDIA, Immich puede usarla para acelerar el reconocimiento facial y la búsqueda inteligente con una variante `-cuda` de la imagen de `immich-machine-learning`. Requiere instalar el NVIDIA Container Toolkit en el host. Está fuera del alcance de este episodio, pero tienes todos los detalles en la [documentación oficial de Immich](https://docs.immich.app/features/ml-hardware-acceleration/).
:::

No olvides desactivar la caducidad del dispositivo también para `immich` en [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines).

---

## Watchtower: notificaciones de actualizaciones

Hasta ahora hemos desplegado cuatro servicios (Nextcloud, Vaultwarden, Immich y sus piezas internas), cada uno en su carpeta. Mantenerlos actualizados a mano, comprobando uno por uno si hay imagen nueva, no escala. **Watchtower** vigila todos los contenedores del host y te avisa cuando hay una actualización disponible.

:::caution
La imagen clásica `containrrr/watchtower` fue **archivada el 17 de diciembre de 2025** — sus mantenedores dejaron el proyecto y ya no recibe parches de seguridad. La usamos aquí con el fork activamente mantenido y compatible: **`nickfedor/watchtower`**.
:::

A diferencia de los servicios anteriores, Watchtower no necesita su propia carpeta con sidecar de Tailscale — no tiene interfaz web que exponer, solo corre en segundo plano vigilando el resto de contenedores a través del socket de Docker.

### Estructura de carpeta

*Ventana de terminal*

```bash
mkdir -p ~/homelab/watchtower
cd ~/homelab/watchtower
```

### El `docker-compose.yml`

Lo configuramos en **modo solo notificación** (`WATCHTOWER_MONITOR_ONLY: "true"`): te avisa de que hay una versión nueva, pero **no actualiza nada por su cuenta**. Decidir cuándo actualizar cada servicio se queda en tus manos — es preferible revisar el changelog antes de actualizar algo tan delicado como una base de datos.

*Ventana de terminal*

```bash
vim docker-compose.yml
```

```yaml
services:
  watchtower:
    container_name: watchtower
    image: nickfedor/watchtower:latest
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      TZ: Europe/Madrid
      WATCHTOWER_MONITOR_ONLY: "true"
      WATCHTOWER_SCHEDULE: "0 0 9 * * *"
      WATCHTOWER_NOTIFICATIONS: shoutrrr
      WATCHTOWER_NOTIFICATION_URL: ntfy://ntfy.sh/${NTFY_TOPIC}
    env_file:
      - .env
    security_opt:
      - no-new-privileges:true
```

`WATCHTOWER_SCHEDULE: "0 0 9 * * *"` comprueba actualizaciones todos los días a las 9:00 de la mañana. Ajusta la expresión cron a tu gusto.

### Notificaciones con ntfy

Usamos [ntfy.sh](https://ntfy.sh) porque es la forma más simple de recibir notificaciones push que existe: no hay que registrarse, ni crear ningún bot, ni conseguir tokens. Solo necesitas un "tema" — un nombre único que tú te inventas, a modo de canal privado.

1. Elige un nombre de tema difícil de adivinar, por ejemplo `ciprigeek-homelab-a3f9k2` (cualquiera que sepa el nombre exacto del tema puede leer tus notificaciones, así que cuanto más aleatorio, mejor).
2. Instala la app de **ntfy** en tu móvil ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/us/app/ntfy/id1625396347)), o simplemente abre `https://ntfy.sh/tu-tema` en el navegador.
3. Suscríbete a tu tema desde la app (botón **+** → pega el nombre del tema).

`.env`:

*Ventana de terminal*

```bash
vim .env
```

```bash
NTFY_TOPIC=ciprigeek-homelab-a3f9k2
```

### Levanta el servicio

*Ventana de terminal*

```bash
docker compose up -d
```

Comprueba los logs para confirmar que ha detectado el resto de contenedores, y que la notificación de arranque te ha llegado a la app de ntfy (o al navegador si tienes `https://ntfy.sh/tu-tema` abierto):

*Ventana de terminal*

```bash
docker compose logs -f watchtower
```

A partir de ahora, cada vez que Nextcloud, Vaultwarden o Immich tengan una imagen nueva disponible, te llegará una notificación push — y decides tú cuándo y cómo actualizar cada uno.

---

## Qué hemos conseguido

- Vaultwarden desplegado como gestor de contraseñas autoalojado, con registro cerrado tras crear tu cuenta.
- Immich desplegado con base de datos vectorial, caché Redis y motor de machine learning propios.
- Ambos con subdominio propio y HTTPS automático vía Tailscale, sin abrir un solo puerto en el router.
- Watchtower vigilando todos los contenedores del homelab y avisándote por ntfy cuando hay actualizaciones, sin aplicarlas por su cuenta.
- El mismo patrón de carpeta + sidecar Tailscale + IPs fijas que ya conoces del episodio 2, aplicado a dos servicios más.

Con esto cerramos, por ahora, la serie de "Tu primer HomeLab (powered by HP)". Si te ha servido, ya sabes dónde encontrar el resto de episodios: en la [documentación completa en ciprigeek.com](/homelab-by-hp/).
