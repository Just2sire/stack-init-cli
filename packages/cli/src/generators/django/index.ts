import type { Model, ProjectConfig } from '@stack-init/schema'
import { snakeCase, pluralize, modelToTableName } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

type AnyField = { name: string; type: string; nullable?: boolean; unique?: boolean; default?: any; values?: string[] }

// ─── Django field type mapping ────────────────────────────────────────────────

function toDjangoField(f: AnyField): string {
  const extras: string[] = []
  if (f.nullable) extras.push('null=True', 'blank=True')
  if (f.unique)   extras.push('unique=True')

  const extra = extras.length ? ', ' + extras.join(', ') : ''

  switch (f.type) {
    case 'string':
      return buildCharField(f, extra)
    case 'char':
      return `models.CharField(max_length=1${extra})`
    case 'text':
    case 'longText':
    case 'mediumText':
    case 'tinyText':
      return `models.TextField(${extras.join(', ')})`
    case 'integer':
    case 'smallInteger':
    case 'mediumInteger':
    case 'tinyInteger':
      return `models.IntegerField(${extras.join(', ')})`
    case 'bigInteger':
    case 'unsignedBigInteger':
      return `models.BigIntegerField(${extras.join(', ')})`
    case 'unsignedInteger':
    case 'unsignedSmallInteger':
    case 'unsignedTinyInteger':
      return `models.PositiveIntegerField(${extras.join(', ')})`
    case 'float':
    case 'double':
      return `models.FloatField(${extras.join(', ')})`
    case 'decimal':
      return `models.DecimalField(max_digits=10, decimal_places=2${extra})`
    case 'boolean':
      return `models.BooleanField(${extras.join(', ')})`
    case 'date':
      return `models.DateField(${extras.join(', ')})`
    case 'dateTime':
    case 'timestamp':
    case 'dateTimeTz':
    case 'timestampTz':
      return `models.DateTimeField(${extras.join(', ')})`
    case 'time':
    case 'timeTz':
      return `models.TimeField(${extras.join(', ')})`
    case 'json':
    case 'jsonb':
      return `models.JSONField(${extras.join(', ')})`
    case 'uuid':
      return `models.UUIDField(default=uuid.uuid4, editable=False${extra})`
    case 'foreignId':
      return `models.IntegerField(${extras.join(', ')})`
    default:
      return buildCharField(f, extra)
  }
}

function buildCharField(f: AnyField, extra: string): string {
  const hasDefault = f.default !== undefined && f.default !== null
  const defaultPart = hasDefault ? `, default=${JSON.stringify(String(f.default))}` : ''
  return `models.CharField(max_length=255${defaultPart}${extra})`
}

function needsUuidImport(model: Model): boolean {
  return model.fields.some(raw => (raw as AnyField).type === 'uuid')
}

function toPythonModuleName(name: string): string {
  return name.replace(/-/g, '_').replace(/\s+/g, '_').toLowerCase()
}

// ─── File generators ──────────────────────────────────────────────────────────

function generateRequirements(): string {
  return [
    'Django>=5.0,<6.0',
    'djangorestframework>=3.15',
    'psycopg2-binary>=2.9',
    'python-dotenv>=1.0',
    'django-cors-headers>=4.3',
  ].join('\n') + '\n'
}

function generatePyproject(projectName: string, pythonVersion: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `[project]
name = "${slug}"
version = "0.1.0"
description = ""
requires-python = ">=${pythonVersion}"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.backends.legacy:build"
`
}

function generateDotEnv(projectName: string): string {
  const pyModule = toPythonModuleName(projectName)
  return `DATABASE_URL="postgresql://user:password@localhost:5432/${pyModule}"
SECRET_KEY="stack-init-dev-secret-key-change-in-production"
DEBUG="True"
`
}

function generateDotEnvExample(projectName: string): string {
  const pyModule = toPythonModuleName(projectName)
  return `DATABASE_URL="postgresql://user:password@localhost:5432/${pyModule}"
SECRET_KEY="your-secret-key-here"
DEBUG="True"
`
}

function generateGitignore(): string {
  return `# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg
*.egg-info/
dist/
build/
.eggs/

# Virtual env
venv/
.venv/
env/
.env/

# Django
*.log
db.sqlite3
media/
staticfiles/

# Environment variables
.env

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`
}

function generateMakefile(projectName: string): string {
  return `.PHONY: install migrate run shell createsuperuser

install:
\tpip install -r requirements.txt

migrate:
\tpython manage.py makemigrations && python manage.py migrate

run:
\tpython manage.py runserver

shell:
\tpython manage.py shell

createsuperuser:
\tpython manage.py createsuperuser
`
}

function generateManagePy(pyModule: string): string {
  return `#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${pyModule}.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
`
}

function generateSettings(pyModule: string, projectName: string, models: Model[]): string {
  const installedApps = [
    '    # Django built-in',
    "    'django.contrib.admin',",
    "    'django.contrib.auth',",
    "    'django.contrib.contenttypes',",
    "    'django.contrib.sessions',",
    "    'django.contrib.messages',",
    "    'django.contrib.staticfiles',",
    '    # Third-party',
    "    'rest_framework',",
    "    'corsheaders',",
    '    # Local apps',
    ...models.map(m => `    'apps.${snakeCase(m.name)}',`),
  ].join('\n')

  return `import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('SECRET_KEY', 'insecure-fallback-key')

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
${installedApps}
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = '${pyModule}.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = '${pyModule}.wsgi.application'

# Database
_db_url = os.environ.get('DATABASE_URL', 'postgresql://user:password@localhost:5432/${pyModule}')

def _parse_db_url(url: str) -> dict:
    """Parse a DATABASE_URL into Django DATABASES dict."""
    import re
    pattern = r'^(?P<scheme>[^:]+)://(?P<user>[^:@]*)(?::(?P<password>[^@]*))?@(?P<host>[^:/]*)(?::(?P<port>\\d+))?/(?P<name>.+)$'
    m = re.match(pattern, url)
    if not m:
        return {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.path.join(BASE_DIR, 'db.sqlite3')}
    scheme = m.group('scheme').replace('+psycopg2', '').replace('+psycopg', '')
    engine_map = {
        'postgresql': 'django.db.backends.postgresql',
        'postgres': 'django.db.backends.postgresql',
        'mysql': 'django.db.backends.mysql',
        'sqlite': 'django.db.backends.sqlite3',
    }
    return {
        'ENGINE': engine_map.get(scheme, 'django.db.backends.postgresql'),
        'NAME': m.group('name'),
        'USER': m.group('user') or '',
        'PASSWORD': m.group('password') or '',
        'HOST': m.group('host') or 'localhost',
        'PORT': m.group('port') or '5432',
    }

DATABASES = {
    'default': _parse_db_url(_db_url),
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PERMISSION_CLASSES': [],
}

# CORS
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
]
`
}

function generateProjectUrls(models: Model[]): string {
  const urlPatterns = models.map(m => {
    const mSnake  = snakeCase(m.name)
    const mPlural = pluralize(mSnake)
    return `    path('api/${mPlural}/', include('apps.${mSnake}.urls')),`
  }).join('\n')

  return `from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
${urlPatterns}
]
`
}

function generateWsgi(pyModule: string): string {
  return `import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${pyModule}.settings')

application = get_wsgi_application()
`
}

function generateAsgi(pyModule: string): string {
  return `import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${pyModule}.settings')

application = get_asgi_application()
`
}

// ─── Per-app file generators ──────────────────────────────────────────────────

function generateAppConfig(mSnake: string, modelName: string): string {
  return `from django.apps import AppConfig


class ${modelName}Config(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.${mSnake}'
`
}

function generateAppModel(model: Model): string {
  const mSnake  = snakeCase(model.name)
  const hasUuid = needsUuidImport(model)
  const uuidImport = hasUuid ? 'import uuid\n' : ''

  const userFields = model.fields.filter(raw => (raw as AnyField).type !== 'id')

  const fieldLines = userFields.map(raw => {
    const f = raw as AnyField
    return `    ${f.name} = ${toDjangoField(f)}`
  }).join('\n')

  const tableName = modelToTableName(model.name)

  return `${uuidImport}from django.db import models


class ${model.name}(models.Model):
${fieldLines || '    pass'}

    class Meta:
        db_table = '${tableName}'

    def __str__(self):
        return f'${model.name} #{"{self.pk}"}'
`
}

function generateSerializer(model: Model): string {
  return `from rest_framework import serializers
from .models import ${model.name}


class ${model.name}Serializer(serializers.ModelSerializer):
    class Meta:
        model = ${model.name}
        fields = '__all__'
`
}

function generateViews(model: Model): string {
  const mSnake  = snakeCase(model.name)
  const mPlural = pluralize(mSnake)

  return `from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from .models import ${model.name}
from .serializers import ${model.name}Serializer


class ${model.name}ViewSet(viewsets.ModelViewSet):
    queryset = ${model.name}.objects.all()
    serializer_class = ${model.name}Serializer
`
}

function generateAppUrls(model: Model): string {
  const mSnake  = snakeCase(model.name)
  const mPlural = pluralize(mSnake)

  return `from rest_framework.routers import DefaultRouter
from .views import ${model.name}ViewSet

router = DefaultRouter()
router.register(r'', ${model.name}ViewSet, basename='${mSnake}')

urlpatterns = router.urls
`
}

// ─── Generator class ──────────────────────────────────────────────────────────

export class DjangoGenerator {
  async generate(config: ProjectConfig, _projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }

    const pythonVersion = '3.11'
    const pyModule      = toPythonModuleName(config.name)
    const projectName   = config.name

    // Validate python module name
    if (!/^[a-z_][a-z0-9_]*$/.test(pyModule)) {
      result.warnings.push(
        `Project name "${projectName}" produced an invalid Python module name "${pyModule}". ` +
        `Rename your project to use only letters, digits, hyphens or underscores.`
      )
    }

    if (config.models.length === 0) {
      result.warnings.push('No models found — the Django project will be generated without any apps.')
    }

    // ── Top-level files ────────────────────────────────────────────────────

    result.files.push({ outputPath: 'requirements.txt',  content: generateRequirements() })
    result.files.push({ outputPath: 'pyproject.toml',    content: generatePyproject(projectName, pythonVersion) })
    result.files.push({ outputPath: '.python-version',   content: `${pythonVersion}\n` })
    result.files.push({ outputPath: '.env',              content: generateDotEnv(projectName) })
    result.files.push({ outputPath: '.env.example',      content: generateDotEnvExample(projectName) })
    result.files.push({ outputPath: '.gitignore',        content: generateGitignore() })
    result.files.push({ outputPath: 'Makefile',          content: generateMakefile(projectName) })
    result.files.push({ outputPath: 'manage.py',         content: generateManagePy(pyModule) })

    // ── Django project package ─────────────────────────────────────────────

    result.files.push({ outputPath: `${pyModule}/__init__.py`, content: '' })
    result.files.push({ outputPath: `${pyModule}/settings.py`, content: generateSettings(pyModule, projectName, config.models) })
    result.files.push({ outputPath: `${pyModule}/urls.py`,     content: generateProjectUrls(config.models) })
    result.files.push({ outputPath: `${pyModule}/wsgi.py`,     content: generateWsgi(pyModule) })
    result.files.push({ outputPath: `${pyModule}/asgi.py`,     content: generateAsgi(pyModule) })

    // ── apps/__init__.py ───────────────────────────────────────────────────

    result.files.push({ outputPath: 'apps/__init__.py', content: '' })

    // ── Per-model apps ─────────────────────────────────────────────────────

    for (const model of config.models) {
      const mSnake = snakeCase(model.name)

      // Warn if all fields are id-type (would leave model body empty)
      const nonIdFields = model.fields.filter(raw => (raw as AnyField).type !== 'id')
      if (nonIdFields.length === 0) {
        result.warnings.push(
          `Model "${model.name}" has no fields besides "id" — Django will generate an empty model body.`
        )
      }

      result.files.push({ outputPath: `apps/${mSnake}/__init__.py`, content: '' })
      result.files.push({ outputPath: `apps/${mSnake}/apps.py`,     content: generateAppConfig(mSnake, model.name) })
      result.files.push({ outputPath: `apps/${mSnake}/models.py`,   content: generateAppModel(model) })
      result.files.push({ outputPath: `apps/${mSnake}/serializers.py`, content: generateSerializer(model) })
      result.files.push({ outputPath: `apps/${mSnake}/views.py`,    content: generateViews(model) })
      result.files.push({ outputPath: `apps/${mSnake}/urls.py`,     content: generateAppUrls(model) })
    }

    return result
  }
}
