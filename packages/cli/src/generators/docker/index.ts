import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateDockerFiles(config: ProjectConfig, isMixed: boolean): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const stack    = config.stack as string
  const name     = config.name
  const dbEngine = config.express?.db_engine ?? config.nestjs?.db_engine ?? config.fastapi?.db_engine ?? 'postgresql'

  const isExpress = stack.includes('express') || stack === 'mern' || stack === 'pern' || stack === 'mevn' || stack === 'mean'
  const isNest    = stack.includes('nestjs')
  const isFastapi = stack.includes('fastapi')
  const isLaravel = stack.includes('laravel')
  const isNextjs  = stack.includes('nextjs')
  const isReact   = stack === 'react'
  const isMevn    = stack === 'mevn'
  const isT3      = stack === 't3'
  const isDjango  = stack === 'django'

  const isPostgres = dbEngine === 'postgresql'
  const isMysql    = dbEngine === 'mysql'
  const isMongo    = dbEngine === 'mongodb' || stack === 'mern' || stack === 'mevn' || stack === 'mean'
  const dbService  = isPostgres ? 'postgres' : isMysql ? 'mysql' : 'mongo'

  const backendPort    = isFastapi ? 8000 : 3000
  const backendContext = isMixed ? './backend' : '.'
  const envFile        = isMixed ? 'backend/.env' : '.env'

  const pythonVersion = config.fastapi?.python_version ?? '3.11'
  const phpVersion    = config.laravel?.php_version    ?? '8.4'
  const laravelDbEngine  = config.laravel?.db_engine ?? 'mysql'
  const laravelUseRedis  = isLaravel && (config.laravel?.use_redis ?? false)
  const laravelHasQueues = isLaravel && (
    laravelUseRedis ||
    config.models.some(m => m.generate.observer && m.generate.events)
  )

  // ── docker-compose.yml ──────────────────────────────────────────────────────
  const svcs: string[] = []

  const hasBackend = isExpress || isNest || isFastapi || isLaravel || isT3 || isDjango

  if (isPostgres && hasBackend) {
    svcs.push(`  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${name}
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d ${name}"]
      interval: 10s
      timeout: 5s
      retries: 5`)
  } else if (isMysql && hasBackend) {
    svcs.push(`  mysql:
    image: mysql:8
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${name}
      MYSQL_USER: user
      MYSQL_PASSWORD: password
      MYSQL_ROOT_PASSWORD: rootpassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "user", "-ppassword"]
      interval: 10s
      timeout: 5s
      retries: 5`)
  } else if (isMongo && hasBackend) {
    svcs.push(`  mongo:
    image: mongo:7
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5`)
  }

  if (isT3) {
    svcs.push(`  app:
    build:
      context: .
      target: production
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    networks:
      - app-network
    depends_on:
      ${dbService}:
        condition: service_healthy`)
  } else if (isDjango) {
    svcs.push(`  backend:
    build:
      context: ${backendContext}
      target: production
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - ${envFile}
    networks:
      - app-network
    depends_on:
      ${dbService}:
        condition: service_healthy`)
  } else if (isLaravel) {
    svcs.push(`  backend:
    build:
      context: ${backendContext}
      target: production
    restart: unless-stopped
    env_file:
      - ${envFile}
    networks:
      - app-network
    depends_on:
      ${dbService}:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "php-fpm -t || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s`)

    // Nginx reverse proxy for Laravel (PHP-FPM)
    svcs.push(`  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - .:/var/www/html:ro
    networks:
      - app-network
    depends_on:
      backend:
        condition: service_healthy`)

    // Optional Redis
    if (laravelUseRedis) {
      svcs.push(`  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5`)
    }

    // Queue worker (when redis or observer+events are enabled)
    if (laravelHasQueues) {
      const queueDepends = laravelUseRedis
        ? `${dbService}:\n        condition: service_healthy\n      redis:\n        condition: service_healthy`
        : `${dbService}:\n        condition: service_healthy`
      svcs.push(`  queue:
    build:
      context: ${backendContext}
      target: production
    restart: unless-stopped
    command: php artisan queue:work --tries=3 --sleep=3
    env_file:
      - ${envFile}
    networks:
      - app-network
    depends_on:
      ${queueDepends}`)
    }
  } else if (isExpress || isNest || isFastapi) {
    svcs.push(`  backend:
    build:
      context: ${backendContext}
      target: production
    restart: unless-stopped
    ports:
      - "${backendPort}:${backendPort}"
    env_file:
      - ${envFile}
    networks:
      - app-network
    depends_on:
      ${dbService}:
        condition: service_healthy`)
  }

  if (isMixed) {
    svcs.push(`  frontend:
    build:
      context: ./frontend
      target: production
    restart: unless-stopped
    ports:
      - "80:80"
    networks:
      - app-network
    depends_on:
      - backend`)
  }

  const volumes = [
    isPostgres && 'postgres_data:',
    isMysql    && 'mysql_data:',
    isMongo    && 'mongo_data:',
    laravelUseRedis && 'redis_data:',
  ].filter(Boolean)

  const dockerCompose = [
    'version: "3.9"',
    '',
    'networks:',
    '  app-network:',
    '    driver: bridge',
    '',
    'services:',
    svcs.join('\n\n'),
    ...(volumes.length ? ['', 'volumes:', ...volumes.map(v => `  ${v}`)] : []),
    '',
  ].join('\n')

  if (svcs.length > 0) {
    files.push({ outputPath: 'docker-compose.yml', content: dockerCompose })
  }

  // ── Backend Dockerfile ──────────────────────────────────────────────────────
  if (isDjango) {
    const dockerfilePath = isMixed ? 'backend/Dockerfile' : 'Dockerfile'
    const ignorePath     = isMixed ? 'backend/.dockerignore' : '.dockerignore'
    files.push({
      outputPath: dockerfilePath,
      content: `FROM python:3.11-slim AS builder
WORKDIR /app
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/packages -r requirements.txt

FROM python:3.11-slim AS production
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PYTHONPATH=/app/packages
COPY --from=builder /app/packages ./packages
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
`,
    })
    files.push({
      outputPath: ignorePath,
      content: `__pycache__\n*.pyc\n*.pyo\n.venv\nvenv\n.env\n*.egg-info\ndist\n.pytest_cache\ndb.sqlite3\n`,
    })
  } else if (isT3) {
    files.push({
      outputPath: 'Dockerfile',
      content: `FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production \\
    NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \\
    && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`,
    })
    files.push({
      outputPath: '.dockerignore',
      content: `node_modules\n.next\n.env\n*.log\ncoverage\n`,
    })
  } else if (isFastapi) {
    const dockerfilePath = isMixed ? 'backend/Dockerfile' : 'Dockerfile'
    const ignorePath     = isMixed ? 'backend/.dockerignore' : '.dockerignore'
    files.push({
      outputPath: dockerfilePath,
      content: `FROM python:${pythonVersion}-slim AS builder
WORKDIR /app
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/packages -r requirements.txt

FROM python:${pythonVersion}-slim AS production
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PYTHONPATH=/app/packages
COPY --from=builder /app/packages ./packages
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
    })
    files.push({
      outputPath: ignorePath,
      content: `__pycache__\n*.pyc\n*.pyo\n.venv\nvenv\n.env\n*.egg-info\ndist\n.pytest_cache\n`,
    })
  } else if (isLaravel) {
    const dbExtensions = laravelDbEngine === 'pgsql'
      ? 'pdo pdo_pgsql bcmath zip gd'
      : 'pdo pdo_mysql bcmath zip gd'
    const redisExtBlock = laravelUseRedis
      ? `\nRUN apk add --no-cache $PHPIZE_DEPS \\\n    && pecl install redis \\\n    && docker-php-ext-enable redis \\\n    && apk del $PHPIZE_DEPS`
      : ''
    files.push({
      outputPath: 'Dockerfile',
      content: `FROM composer:2 AS builder
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --optimize-autoloader

FROM php:${phpVersion}-fpm-alpine AS production
WORKDIR /var/www/html
RUN apk add --no-cache libpng-dev libzip-dev libpq-dev zip \\
    && docker-php-ext-install ${dbExtensions}${redisExtBlock}
COPY --from=builder /app/vendor ./vendor
COPY . .
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
EXPOSE 9000
CMD ["php-fpm"]
`,
    })
    files.push({
      outputPath: '.dockerignore',
      content: `vendor\nnode_modules\n.env\nstorage/logs/*\nstorage/framework/cache/*\nstorage/framework/sessions/*\nstorage/framework/views/*\nbootstrap/cache/*\npublic/hot\n`,
    })
    // Nginx config for PHP-FPM reverse proxy
    files.push({
      outputPath: 'docker/nginx/nginx.conf',
      content: laravelNginxConf(),
    })
  } else if (isExpress || isNest) {
    const dockerfilePath = isMixed ? 'backend/Dockerfile' : 'Dockerfile'
    const ignorePath     = isMixed ? 'backend/.dockerignore' : '.dockerignore'
    const entrypoint     = isNest ? 'dist/main.js' : 'dist/server.js'
    files.push({
      outputPath: dockerfilePath,
      content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "${entrypoint}"]
`,
    })
    files.push({
      outputPath: ignorePath,
      content: `node_modules\ndist\n.env\n*.log\ncoverage\n`,
    })
  } else if (isNextjs) {
    files.push({
      outputPath: 'Dockerfile',
      content: `FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS production
ENV NODE_ENV=production \\
    NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \\
    && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`,
    })
    files.push({
      outputPath: '.dockerignore',
      content: `node_modules\n.next\n.env\n*.log\ncoverage\n`,
    })
  } else if (isReact || isMevn) {
    files.push({
      outputPath: 'Dockerfile',
      content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`,
    })
    files.push({
      outputPath: '.dockerignore',
      content: `node_modules\ndist\n.env\n*.log\n`,
    })
    files.push({
      outputPath: 'nginx.conf',
      content: nginxConf(),
    })
  }

  // ── Frontend Dockerfile (mixed stacks) ─────────────────────────────────────
  if (isMixed) {
    const isNextFrontend = stack.includes('nextjs')
    if (isNextFrontend) {
      files.push({
        outputPath: 'frontend/Dockerfile',
        content: `FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS production
ENV NODE_ENV=production \\
    NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \\
    && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`,
      })
    } else {
      files.push({
        outputPath: 'frontend/Dockerfile',
        content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`,
      })
      files.push({ outputPath: 'frontend/nginx.conf', content: nginxConf() })
    }
    files.push({
      outputPath: 'frontend/.dockerignore',
      content: `node_modules\ndist\n.next\n.env\n*.log\n`,
    })
  }

  return files
}

function laravelNginxConf(): string {
  return `server {
    listen 80;
    server_name localhost;
    root /var/www/html/public;
    index index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \\.php$ {
        fastcgi_pass backend:9000;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}
`
}

function nginxConf(): string {
  return `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`
}
