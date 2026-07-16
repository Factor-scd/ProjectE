# Deployment Guide

Deploy Project E with Docker Compose and Nginx Proxy Manager. Three containers run the application: web (Next.js), db (PocketBase), and worker (background jobs).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deploy](#quick-deploy)
- [Environment Configuration](#environment-configuration)
- [Nginx Proxy Manager Setup](#nginx-proxy-manager-setup)
- [PocketBase Setup](#pocketbase-setup)
- [Backups](#backups)
- [Monitoring](#monitoring)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Docker** 24.0 or later
- **Docker Compose** 2.20 or later
- **Nginx Proxy Manager** installed and running
- **At least 1GB RAM** and 10GB disk space

## Quick Deploy

1. **Clone the repository on your server**

   ```bash
   git clone <repository-url>
   cd ProjectE
   ```

2. **Create the environment file**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set the required variables:

   ```bash
   POCKETBASE_ADMIN_TOKEN=your-secure-random-token
   PUBLIC_URL=http://project-e.local
   COOKIE_SECURE=false
   ALLOWED_HOSTS=project-e.local,localhost
   ```

   Generate a secure token:

   ```bash
   openssl rand -hex 32
   ```

3. **Build and start containers**

   ```bash
   docker compose up -d
   ```

4. **Verify all containers are running**

   ```bash
   docker compose ps
   ```

   You should see three containers with status `Up (healthy)`:
   - `project-e-web` (internal only, no exposed ports)
   - `project-e-db` (internal only, no exposed ports)
   - `project-e-worker` running in the background

5. **Configure Nginx Proxy Manager** (see below)

6. **Create your admin account**

   Once NPM is configured, access Project E through your domain. Create your first user account.

## Environment Configuration

### Required Variables

| Variable | Description |
|----------|-------------|
| `POCKETBASE_ADMIN_TOKEN` | Admin token from PocketBase. Required for the worker and server-side API operations. |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POCKETBASE_URL` | `http://db:8090` | PocketBase URL (internal Docker network) |
| `NODE_ENV` | `production` | Node environment |
| `PUBLIC_URL` | `http://localhost:3000` | Public URL where users access Project E (used for generating absolute URLs) |
| `COOKIE_SECURE` | `false` | Set to `true` if using HTTPS through NPM, `false` for HTTP-only LAN access |
| `ALLOWED_HOSTS` | `localhost` | Comma-separated list of domains that can access the app |

### Setting Variables

Create a `.env` file in the project root:

```bash
POCKETBASE_ADMIN_TOKEN=abc123def456...
POCKETBASE_URL=http://db:8090
PUBLIC_URL=http://project-e.local
COOKIE_SECURE=false
ALLOWED_HOSTS=project-e.local,localhost
```

Docker Compose reads this file automatically.

## Nginx Proxy Manager Setup

### Add Proxy Host

1. Open Nginx Proxy Manager admin interface
2. Go to **Hosts** → **Proxy Hosts** → **Add Proxy Host**

3. Configure the following:

   **Details Tab:**
   - **Domain Names:** `project-e.local` (or your chosen domain)
   - **Scheme:** `http`
   - **Forward Hostname/IP:** `project-e-web` (the Docker container name)
   - **Forward Port:** `3000`

   **SSL Tab:**
   - If using HTTPS: Select your SSL certificate
   - If HTTP-only on LAN: Leave SSL disabled

   **Advanced Tab:**
   Add these custom Nginx configuration lines:

   ```nginx
   # WebSocket support for realtime features
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   
   # Forward real client information
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header Host $host;
   
   # SSE support for realtime endpoint
   proxy_buffering off;
   proxy_cache off;
   proxy_read_timeout 300s;
   
   # Increase timeout for long-running requests
   proxy_connect_timeout 300s;
   proxy_send_timeout 300s;
   ```

4. Click **Save**

### Testing the Connection

1. From a device on your LAN, open a browser
2. Navigate to `http://project-e.local` (or your configured domain)
3. You should see the Project E login page

### Optional: PocketBase Admin Access

If you need direct access to the PocketBase admin UI:

1. In NPM, add another Proxy Host:
   - **Domain Names:** `pb.project-e.local`
   - **Scheme:** `http`
   - **Forward Hostname/IP:** `project-e-db`
   - **Forward Port:** `8090`

2. Or temporarily expose the port in `docker-compose.yml`:
   ```yaml
   db:
     ports:
       - "8090:8090"
   ```

## PocketBase Setup

### Initial Configuration

PocketBase runs as a standalone container. After starting it for the first time:

1. Access the admin UI at `http://your-server:8090/_/`
2. Create your admin account
3. Configure authentication settings under **Settings > Auth**
4. Enable the auth methods you need (email/password is enabled by default)

### Migrations

Database migrations are in `pocketbase/pb_migrations/`. They run automatically when the PocketBase container starts.

To add a new migration:

1. Create a file in `pocketbase/pb_migrations/` with the naming convention `YYYYMMDDHHMMSS_description.js`
2. Restart the PocketBase container: `docker compose restart db`

### Data Directory

PocketBase stores all data (SQLite database, uploads, logs) in the `/pb_data` volume. This volume persists across container restarts.

## Reverse Proxy

Put a reverse proxy in front of the application to handle SSL, compression, and routing.

### Caddy (Recommended)

Caddy handles SSL automatically.

Create a `Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
    }
}

pb.your-domain.com {
    reverse_proxy localhost:8090
}
```

Install and run Caddy:

```bash
# Install Caddy
sudo apt install caddy  # Debian/Ubuntu
# or
brew install caddy      # macOS

# Start Caddy
caddy start
```

### Traefik

Create a `traefik.yml`:

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    exposedByDefault: false
```

Update `docker-compose.yml` to add Traefik labels:

```yaml
services:
  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.web.entrypoints=websecure"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"
```

### Nginx

Create `/etc/nginx/sites-available/project-e`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE support for realtime endpoint
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/project-e /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL/TLS

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d pb.your-domain.com

# Auto-renewal is configured automatically
```

### Caddy

Caddy obtains and renews certificates automatically. No configuration needed beyond the domain name in the `Caddyfile`.

### Internal Communication

The web and worker containers connect to PocketBase over the internal Docker network (`http://db:8090`). This traffic does not need SSL.

Only expose ports 3000 and 8090 to the reverse proxy, not directly to the internet.

## Backups

### PocketBase Database

The database is a single SQLite file at `/pb_data/data.db`.

**Manual backup:**

```bash
# Stop the container to ensure consistency
docker compose stop db

# Copy the database file
docker cp project-e-db:/pb_data/data.db ./backups/data-$(date +%Y%m%d).db

# Restart the container
docker compose start db
```

**Automated backup script:**

Create `scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Use PocketBase's backup API (no downtime)
curl -X POST http://localhost:8090/api/backup \
  -H "Authorization: Admin your-admin-token" \
  -o "$BACKUP_DIR/backup-$DATE.zip"

# Keep only last 30 backups
find $BACKUP_DIR -name "backup-*.zip" -mtime +30 -delete

echo "Backup completed: backup-$DATE.zip"
```

Schedule with cron:

```bash
# Run daily at 2 AM
0 2 * * * /path/to/scripts/backup.sh
```

### Upload Files

Uploaded files are stored in the `project-e-web-uploads` volume.

**Backup uploads:**

```bash
docker run --rm \
  -v project-e-web-uploads:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine \
  tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /source .
```

### Restore

**Restore database:**

```bash
# Stop containers
docker compose stop db

# Remove old data
docker volume rm project-e-pb-data

# Copy backup into new volume
docker volume create project-e-pb-data
docker run --rm \
  -v project-e-pb-data:/pb_data \
  -v $(pwd)/backups:/backup \
  alpine \
  sh -c "cp /backup/data-YYYYMMDD.db /pb_data/data.db"

# Restart
docker compose start db
```

**Restore uploads:**

```bash
docker run --rm \
  -v project-e-web-uploads:/target \
  -v $(pwd)/backups:/backup \
  alpine \
  sh -c "cd /target && tar xzf /backup/uploads-YYYYMMDD.tar.gz"
```

## Monitoring

### Container Health

All containers include health checks. Check status:

```bash
docker compose ps
```

### Application Health

The web container exposes a health endpoint:

```bash
curl http://localhost:3000/api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "0.1.0"
}
```

### Logs

View logs from all containers:

```bash
# All containers
docker compose logs -f

# Specific container
docker compose logs -f web
docker compose logs -f db
docker compose logs -f worker
```

### Resource Usage

Monitor container resource usage:

```bash
docker stats
```

### Uptime Monitoring

Use an external service to monitor your deployment:

- **UptimeRobot** (free tier): HTTP monitoring with email/SMS alerts
- **Healthchecks.io**: Cron job monitoring
- **Better Stack**: Status pages and incident management

Set up a check for `https://your-domain.com/api/health` with a 60-second interval.

## Scaling

### Vertical Scaling

The application runs as a single instance of each container. To handle more load:

1. **Increase server resources**: Add more CPU and RAM to your host
2. **Increase Node.js memory**: Set `NODE_OPTIONS=--max-old-space-size=4096` in the web container
3. **Increase PocketBase limits**: PocketBase handles thousands of concurrent connections on modest hardware

### Horizontal Scaling

Horizontal scaling requires changes to the architecture:

**Current limitations:**
- MCP sessions are stored in memory (not shared between instances)
- SSE connections are tied to a specific container
- File uploads go to a local volume

**To scale horizontally:**
1. Use a shared session store (Redis)
2. Use a load balancer with sticky sessions for SSE
3. Use object storage (S3) for file uploads
4. Run multiple web containers behind a load balancer

For most personal and small-team use cases, a single instance handles the load. PocketBase with SQLite performs well up to hundreds of concurrent users.

### Worker Scaling

The worker uses polling with exponential backoff. For high-throughput job processing:

1. Run multiple worker containers (they coordinate through the database)
2. Reduce the base poll interval (currently 5 seconds)
3. Use a dedicated job queue (Bull, BullMQ) instead of database polling

## Troubleshooting

### Container Won't Start

**Check logs:**

```bash
docker compose logs web
docker compose logs db
docker compose logs worker
```

**Common issues:**

| Problem | Solution |
|---------|----------|
| `Cannot connect to PocketBase` | Ensure the `db` container is healthy. Check `docker compose ps`. |
| `Port 3000 already in use` | Change the port mapping in `docker-compose.yml` |
| `POCKETBASE_ADMIN_TOKEN not set` | Set the token in `.env` and restart |
| `Migration failed` | Check migration files in `pocketbase/pb_migrations/` |

### Web App Returns 500 Errors

1. Check the web container logs: `docker compose logs web`
2. Verify PocketBase is running: `docker compose exec db wget -qO- http://localhost:8090/api/health`
3. Verify the admin token is correct: `docker compose exec web env | grep POCKETBASE`

### Realtime Events Not Arriving

1. Check the SSE connection: `curl -N http://localhost:3000/api/realtime`
2. Verify the reverse proxy is not buffering SSE responses
3. For Nginx, ensure `proxy_buffering off` is set
4. Check browser console for connection errors

### Worker Not Processing Jobs

1. Check worker logs: `docker compose logs worker`
2. Verify the admin token is set correctly
3. Check for pending jobs in PocketBase admin: `http://localhost:8090/_/#/collections/queue_jobs`
4. Jobs retry automatically with exponential backoff (max 5 minutes between retries)

### Database Corruption

If the SQLite database becomes corrupted:

1. Stop all containers: `docker compose down`
2. Restore from the most recent backup (see [Backups](#backups))
3. If no backup exists, try SQLite's recovery:

   ```bash
   sqlite3 data.db ".recover" | sqlite3 new-data.db
   ```

4. Replace the corrupted file and restart

### Out of Disk Space

PocketBase stores the database and uploads in the `project-e-pb-data` volume.

**Check disk usage:**

```bash
docker system df
docker volume inspect project-e-pb-data
```

**Clean up:**

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (WARNING: deletes all data)
docker volume prune
```

**Expand volume:**

Docker volumes use the host filesystem. If the host disk is full, expand it or move the volume to a larger disk.

### SSL Certificate Errors

**Caddy:** Check the Caddy logs for ACME errors. Ensure port 80 is accessible from the internet for the HTTP challenge.

**Let's Encrypt:** Certificates renew automatically. Force renewal:

```bash
sudo certbot renew --force-renewal
```

**Common errors:**
- `Connection refused`: Port 80 is blocked by firewall
- `DNS problem`: Domain does not resolve to this server
- `Rate limit exceeded`: Too many certificate requests. Wait and retry.

### Performance Issues

1. **Slow page loads**: Check if the server has enough RAM. Node.js needs at least 512MB.
2. **Slow API responses**: Check PocketBase query performance in the admin panel
3. **SSE disconnects**: Ensure the reverse proxy has appropriate timeout settings (300s+)
4. **Worker falling behind**: Increase the poll frequency or add more worker instances
