# Deployment Guide

Deploy Project E with Docker Compose and a reverse proxy such as Nginx Proxy Manager. Compose runs three services: the Next.js web app, PostgreSQL 16, and the background worker.

## Prerequisites

- Docker 24.0 or later
- Docker Compose 2.20 or later
- A reverse proxy for TLS and public routing
- At least 1 GB RAM and 10 GB disk space

## Deploy Project E

1. Clone the repository on the server.

   ```bash
   git clone <repository-url>
   cd ProjectE
   ```

2. Create the environment file.

   ```bash
   cp .env.example .env
   ```

3. Set the required values in `.env`.

   ```bash
   POSTGRES_PASSWORD=your_postgres_password
   DATABASE_URL=postgresql://project_e:your_postgres_password@localhost:5432/project_e
   NEXTAUTH_SECRET=your_long_random_secret
   INITIAL_ADMIN_EMAIL=admin@example.com
   INITIAL_ADMIN_PASSWORD=your_initial_admin_password
   PUBLIC_URL=https://project-e.example.com
   COOKIE_SECURE=true
   ALLOWED_HOSTS=project-e.example.com
   ```

   Generate secrets with `openssl rand -base64 32`. Use the same `POSTGRES_PASSWORD` in `DATABASE_URL`. The web and worker containers use an internal database URL that Compose builds from `POSTGRES_PASSWORD`.

4. Build and start the services.

   ```bash
   docker compose up -d
   ```

5. Confirm that the services are healthy.

   ```bash
   docker compose ps
   ```

6. Route your domain to `project-e-web:3000` through your reverse proxy.

7. Open the app and sign in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`. Project E creates that account only when the database contains no users.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for local tools and processes outside Compose. |
| `POSTGRES_PASSWORD` | Yes | Password for the `project_e` PostgreSQL user. |
| `NEXTAUTH_SECRET` | Yes | Secret used to sign NextAuth JWT sessions. |
| `INITIAL_ADMIN_EMAIL` | Yes | Email address for the first account. |
| `INITIAL_ADMIN_PASSWORD` | Yes | Password for the first account. |
| `PUBLIC_URL` | No | Public application URL. Defaults to `http://localhost:3000`. |
| `COOKIE_SECURE` | No | Set to `true` behind HTTPS. Defaults to `false`. |
| `ALLOWED_HOSTS` | No | Comma-separated allowed hostnames. |

Keep `.env` out of version control. Rotate `NEXTAUTH_SECRET` only when you intend to end active sessions.

## PostgreSQL and Drizzle

The `db` service runs `postgres:16-alpine`, stores its data in the `project-e-pg-data` Docker volume, and exposes port 5432. The web and worker services connect to `db:5432` over the Compose network.

Docker mounts `drizzle/0000_first_mauler.sql` into PostgreSQL's initialization directory. PostgreSQL runs that file only while it initializes an empty data volume. For a later Drizzle migration, apply the reviewed SQL as part of your release process. Do not expect a container restart to apply a new migration to an existing volume.

To apply a migration from the host, run:

```bash
docker compose exec -T db psql -U project_e -d project_e < drizzle/<migration>.sql
```

Back up the database before applying schema changes.

## Nginx Proxy Manager

1. In Nginx Proxy Manager, open **Hosts** > **Proxy Hosts** > **Add Proxy Host**.
2. Set the domain name, choose `http`, set the forward hostname to `project-e-web`, and set the forward port to `3000`.
3. Select a certificate and force SSL for HTTPS deployments.
4. Add the following advanced configuration to support Server-Sent Events:

   ```nginx
   proxy_http_version 1.1;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header Host $host;
   proxy_buffering off;
   proxy_cache off;
   proxy_read_timeout 300s;
   proxy_connect_timeout 300s;
   proxy_send_timeout 300s;
   ```

5. Save the host and open the configured domain. You should reach the Project E sign-in page.

## Back up and restore PostgreSQL

Create a logical backup without stopping the database:

```bash
mkdir -p backups
```

Restore a backup into a new or empty database:

```bash
docker compose exec -T db psql -U project_e -d project_e < backups/project-e-YYYYMMDD_HHMMSS.sql
```

Back up the `project-e-web-uploads` volume if your deployment stores uploads there:

```bash
docker run --rm \
  -v project-e-web-uploads:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine \
  tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /source .
```

Test restores on a separate environment before relying on a backup.

## Monitoring and logs

Check service status and logs:

```bash
docker compose ps
```

The web service exposes `GET /api/health` on port 3000. Configure uptime monitoring for `https://your-domain.example/api/health`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Database connection fails | Confirm that `db` is healthy and that `POSTGRES_PASSWORD` matches the value in `DATABASE_URL`. |
| The web service will not start | Set `NEXTAUTH_SECRET`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in `.env`, then restart the service. |
| Sign-in fails | Confirm the email and password match the initial-admin values. Those values create an account only before any user exists. |
| A schema change is missing | Apply the generated Drizzle SQL. PostgreSQL initialization scripts do not rerun for an existing volume. |
| Realtime updates stop | Disable proxy buffering and set a read timeout of at least 300 seconds. |
| Disk space runs low | Inspect `project-e-pg-data` and `project-e-web-uploads`, back up data, and expand the host disk. |

## Scaling

The default deployment runs one web service, one worker, and one PostgreSQL instance. Add CPU and memory before changing the topology. Multiple web services require shared session-aware infrastructure and a reverse proxy that supports long-lived SSE connections. Multiple workers coordinate through the PostgreSQL-backed job records.
