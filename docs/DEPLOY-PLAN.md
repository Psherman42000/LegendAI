# Production Deployment Configuration

## Architecture
```
Nginx (SSL) → Next.js (Cluster) → PostgreSQL
                   ↓
              Worker (BullMQ) → Redis
```

## Files to Create

### 1. Dockerfile
- Multi-stage build (deps → builder → runner)
- Node 20 Alpine
- Standalone output
- Non-root user

### 2. docker-compose.yml
- postgres:15-alpine with healthcheck
- redis:7-alpine with healthcheck
- app: Next.js with depends_on
- worker: separate container
- nginx: reverse proxy

### 3. nginx/nginx.conf
- SSL termination
- Rate limiting
- Static file caching
- Reverse proxy to app:3000

### 4. ecosystem.config.js (PM2)
- Cluster mode for Next.js (instances: 'max')
- Single fork for Worker
- Auto-restart with backoff
- Memory limits

### 5. src/app/api/health/route.ts
- Check database
- Check Redis
- Check R2/S3
- Return 200 or 503

### 6. .env.production.example
- All required env vars
- Comments for each

### 7. scripts/deploy.sh + deploy.ps1
- Pre-deployment checks
- Build images
- Run migrations
- Health check loop
- Rollback on failure

### 8. docs/DEPLOY.md
- Quick start
- Architecture diagram
- Environment variables table
- Troubleshooting

## Key Decisions
- **Docker Compose** for simple deployment
- **PM2** as alternative for bare metal
- **Nginx** for SSL and static files
- **Health checks** on all services
- **Separate worker** container for queue processing
