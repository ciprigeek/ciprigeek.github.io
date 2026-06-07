---
title: Red y Networking
description: Arquitectura de red del homelab.
---

## Configurar una IP fija con Netplan

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
sudo nano /etc/netplan/00-installer-config.yaml
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
