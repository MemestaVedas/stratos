# Deployment Guide - Production Setup

Complete guide for deploying Stratos platform to production environments.

## Pre-Deployment Checklist

### Infrastructure Requirements

**Compute Resources**
- Minimum: 8 vCPU, 32 GB RAM per region
- Recommended: 16+ vCPU, 64+ GB RAM for HA
- Kubernetes cluster 1.24+ recommended

**Database**
- PostgreSQL 14+ with pgvector extension
- Minimum: 2 vCPU, 8 GB RAM (development)
- Production: 8+ vCPU, 32+ GB RAM with replication

**Caching & Queuing**
- Redis 7+ cluster mode enabled
- 4+ GB memory minimum
- Persistent storage for durability

**Object Storage**
- S3, GCS, or Azure Blob Storage
- Same region as compute for latency
- Cross-region replication for DR

### Security Preparation

- [ ] Generate SSL/TLS certificates (Let's Encrypt or CA)
- [ ] Create service accounts for each component
- [ ] Generate API keys for integrations
- [ ] Configure OAuth providers (GitHub, Google, etc)
- [ ] Set up secrets vault (AWS Secrets Manager / Vault)
- [ ] Configure network policies and ingress rules
- [ ] Enable CloudTrail/Audit logging
- [ ] Set up VPC and security groups

## Environment Variables

### Meridian Configuration

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/meridian?sslmode=require
DATABASE_POOL_SIZE=20
DATABASE_SSL_CERT=/etc/ssl/certs/server.crt
DATABASE_SSL_KEY=/etc/ssl/private/server.key

# Redis
REDIS_URL=redis://user:pass@redis-host:6379
REDIS_TLS=true
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379

# Authentication
JWT_SECRET=<generate-strong-random-key>
JWT_EXPIRY_HOURS=1
REFRESH_TOKEN_EXPIRY_DAYS=30

# API Configuration
API_PORT=3000
API_HOST=0.0.0.0
CORS_ORIGINS=https://app.stratos.dev,https://admin.stratos.dev
RATE_LIMIT_PER_HOUR=10000

# LLM Integration
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=...
ANTHROPIC_API_KEY=...

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
SENTRY_DSN=https://...@sentry.io/...

# Monitoring
PROMETHEUS_PORT=9090
DATADOG_API_KEY=...

# Feature Flags
ALLOW_WEBHOOK_TRIGGERS=true
ALLOW_CODE_EXECUTION=true
MAX_WORKFLOW_NODES=500
```

## Docker Deployment

### Build Images

```dockerfile
# Dockerfile.meridian
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run application
CMD ["node", "dist/index.js"]
```

### Docker Compose for Development

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: stratos
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: meridian
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-pgvector.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stratos"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  meridian:
    build:
      context: ./meridian/backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://stratos:${DB_PASSWORD}@postgres:5432/meridian
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      NODE_ENV: development
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./meridian/backend/src:/app/src

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Deployment

### Helm Chart Structure

```
stratos-helm/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── deployment/
│   │   ├── meridian-api.yaml
│   │   ├── meridian-worker.yaml
│   │   ├── vektor-api.yaml
│   │   ├── aurum-api.yaml
│   │   └── aurum-ml-service.yaml
│   ├── service/
│   │   ├── meridian.yaml
│   │   ├── vektor.yaml
│   │   └── aurum.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   └── network-policy.yaml
```

### Meridian Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meridian-api
  labels:
    app: meridian
    component: api
spec:
  replicas: {{ .Values.meridian.api.replicas }}
  selector:
    matchLabels:
      app: meridian
      component: api
  template:
    metadata:
      labels:
        app: meridian
        component: api
    spec:
      serviceAccountName: meridian
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: api
        image: "{{ .Values.meridian.api.image }}:{{ .Values.meridian.api.tag }}"
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: meridian-secrets
              key: database-url
        - name: LOG_LEVEL
          value: {{ .Values.logLevel }}
        resources:
          requests:
            memory: "{{ .Values.meridian.api.resources.requests.memory }}"
            cpu: "{{ .Values.meridian.api.resources.requests.cpu }}"
          limits:
            memory: "{{ .Values.meridian.api.resources.limits.memory }}"
            cpu: "{{ .Values.meridian.api.resources.limits.cpu }}"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
```

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: meridian-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: meridian-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 50
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## Database Initialization

### PostgreSQL Setup

```bash
#!/bin/bash
# init-database.sh

# Create database
createdb -U postgres meridian
createdb -U postgres vektor
createdb -U postgres aurum

# Install extensions
psql -U postgres -d meridian -c "CREATE EXTENSION pgvector;"
psql -U postgres -d vektor -c "CREATE EXTENSION pgvector;"

# Run migrations
psql -U postgres -d meridian < meridian/schema.sql
psql -U postgres -d vektor < vektor/schema.sql
psql -U postgres -d aurum < aurum/schema.sql

# Create replication slot for hot standby
psql -U postgres -c "SELECT * FROM pg_create_physical_replication_slot('stratos_slot');"
```

## SSL/TLS Configuration

### Let's Encrypt with Cert-Manager

```yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@stratos.dev
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx

---

apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: stratos-cert
spec:
  secretName: stratos-tls
  issuerRef:
    name: letsencrypt-prod
    kind: Issuer
  dnsNames:
  - api.stratos.dev
  - app.stratos.dev
  - admin.stratos.dev
```

## Monitoring & Logging

### Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
- job_name: 'meridian'
  static_configs:
  - targets: ['meridian:9090']
  
- job_name: 'vektor'
  static_configs:
  - targets: ['vektor:9090']
  
- job_name: 'aurum'
  static_configs:
  - targets: ['aurum:9090']
```

### Datadog Integration

```bash
# Deploy Datadog Agent
helm install datadog datadog/datadog \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.appKey=$DD_APP_KEY \
  --set datadog.logs.enabled=true \
  --set datadog.apm.enabled=true
```

## Health Checks & Liveness

### Health Endpoints

```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      memory: checkMemory()
    }
  };
  
  res.status(200).json(health);
});

app.get('/ready', (req, res) => {
  // Return 503 if not ready to accept traffic
  if (!isReady) {
    return res.status(503).json({ ready: false });
  }
  res.status(200).json({ ready: true });
});
```

## Backup & Disaster Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/mnt/backups"
RETENTION_DAYS=30

# Backup PostgreSQL
pg_dump -h $DB_HOST -U $DB_USER -d meridian | gzip > $BACKUP_DIR/meridian_$(date +%Y%m%d_%H%M%S).sql.gz

# Upload to S3
aws s3 sync $BACKUP_DIR s3://stratos-backups/ --delete

# Cleanup old backups
find $BACKUP_DIR -mtime +$RETENTION_DAYS -delete
```

---

**Last Updated**: March 24, 2026
