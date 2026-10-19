# Deploy desde main a Debian

El workflow `.github/workflows/deploy.yml` compila frontend y backend y usa SSH
para ejecutar `scripts/deploy.sh` en `/opt/projects/ingenio_arrocero`.
No modifica Nginx, elimina volumenes ni ejecuta `script.sql`.
La comprobacion final verifica HTTP del frontend y autenticacion con MariaDB;
no sustituye una prueba de login ni de toda la inicializacion del backend.
No hay rollback automatico ni despliegue sin interrupciones garantizado.

## Preparar antes del primer push

1. Copiar del servidor al repositorio local los Dockerfiles, `.dockerignore`,
   el servidor estatico del frontend y el archivo Compose que ya funcionan.
   Conservar frontend en `127.0.0.1:8082` y backend en `127.0.0.1:3001`.
   No copiar credenciales. Si existen varios archivos Compose, verificar que
   `docker compose` seleccione el correcto.
   Actualizar `frontend/src/environments/environment.prod.ts` para que endpoint
   y apiUrl sean `https://apiroyal.bitsys.com.bo/`; la copia local aun apunta a Render.
2. El seeder `backend/src/seed/admin.seed.ts` crea el primer administrador al
   arrancar si `user` esta vacia. Configurar en `backend/.env.production` del
   servidor `ADMIN_USERNAME=admin` y `ADMIN_PASSWORD` (minimo 12 caracteres,
   maximo 72 bytes). Se guarda un hash bcrypt, no se imprime la clave, y no se
   modifican usuarios existentes. El perfil se crea antes de asignar el menu.
   Estas variables no son los secrets SSH de GitHub.
3. `backend/.env` ya estaba versionado: ignorarlo no retira su historial.
   En local ejecutar `git rm --cached backend/.env` y conservar el archivo local.
   Rotar las credenciales que hayan sido publicadas.
4. En el servidor respaldar `.env`, `.env.production`, uploads, Compose y DB
   fuera del repositorio antes de actualizar. Comprobar que Compose usa
   `backend/.env.production`. La eliminacion versionada de `.env` puede eliminar
   la copia del servidor al actualizar; restaurarla desde respaldo si se necesita.
5. Commitear Docker, automatizacion y salida de `.env` del seguimiento juntos.
   Inicializar manualmente el servidor con ese commit antes de activar el workflow:
   dejar `main`, sin modificaciones versionadas y sin archivos Docker sin registrar
   que entren en conflicto con el pull. No usar reset/clean para resolverlo.

## Acceso SSH

Crear una clave exclusiva para Actions en una maquina de confianza:

```bash
ssh-keygen -t ed25519 -f royal_actions -C royal-github-actions
```

Instalar `royal_actions.pub` en `~/.ssh/authorized_keys` del usuario de deploy.
El usuario debe poder acceder al proyecto y ejecutar Docker sin solicitudes
interactivas. Acceso al socket Docker equivale a privilegios elevados en el host.
El servidor tambien necesita acceso de lectura al repositorio (el remoto publico
HTTPS actual no necesita clave). No compartir las claves privadas por el chat.

Obtener la entrada known_hosts desde una maquina de confianza:

```bash
ssh-keyscan -p 22 IP_DEL_SERVIDOR > royal_known_hosts
ssh-keygen -lf royal_known_hosts
```

Comparar la huella con la mostrada directamente en el servidor:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Verificar la huella ed25519 correspondiente antes de guardar la entrada;
`ssh-keyscan` por si solo no autentica al servidor.

## Secrets de GitHub

Settings > Environments > Production > Add environment secret.
El job declara `environment: Production` para acceder a estos secretos;
no es necesario duplicarlos como secretos del repositorio:

- `DEPLOY_HOST`: IP o hostname SSH del servidor.
- `DEPLOY_USER`: usuario SSH con acceso al proyecto y Docker.
- `DEPLOY_PORT`: puerto SSH (22 si no se define).
- `DEPLOY_SSH_KEY`: contenido completo de la clave privada royal_actions,
  sin passphrase para este workflow.
- `DEPLOY_KNOWN_HOSTS`: contenido de royal_known_hosts verificado.

Las claves de MariaDB, JWT y admin se quedan en el archivo env del servidor.

## Activar y verificar

Tras la preparacion inicial y los secrets, ejecutar Deploy Royal desde Actions
con Run workflow en main. Los siguientes push a main desplegaran automaticamente.
Consultar el resultado en Actions y probar login en demoroyal.bitsys.com.bo.
Ante fallos de arranque, revisar `docker compose logs --tail=150 backend`.
Los seeders del backend se ejecutan al reiniciar y pueden modificar catalogos:
mantener respaldo de MariaDB antes de desplegar cambios de esquema o datos.
