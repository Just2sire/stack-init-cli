import type { Model, ProjectConfig } from '@stack-init/schema'
import { snakeCase, pluralize, modelToTableName } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'
import { sortModelsByDependency } from '../../utils/model-sort'

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

type AnyField = { name: string; type: string; nullable?: boolean; default?: any; values?: string[] }

function toPythonType(type: string): string {
  const map: Record<string, string> = {
    string: 'str', char: 'str', text: 'str', tinyText: 'str', mediumText: 'str', longText: 'str',
    integer: 'int', smallInteger: 'int', tinyInteger: 'int', mediumInteger: 'int', bigInteger: 'int',
    unsignedInteger: 'int', unsignedBigInteger: 'int', unsignedTinyInteger: 'int',
    unsignedSmallInteger: 'int', unsignedMediumInteger: 'int',
    boolean: 'bool',
    float: 'float', double: 'float', decimal: 'float',
    date: 'str', dateTime: 'str', dateTimeTz: 'str',
    timestamp: 'str', timestampTz: 'str',
    time: 'str', timeTz: 'str',
    json: 'dict', jsonb: 'dict',
    uuid: 'str', ulid: 'str',
    foreignId: 'int', foreignUuid: 'str', foreignUlid: 'str',
    enum: 'str', binary: 'bytes', json_: 'dict',
  }
  return map[type] ?? 'str'
}

function modelToSnake(name: string): string {
  return snakeCase(name)
}

export class FastAPIGenerator {
  async generate(config: ProjectConfig, _projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    const opts = config.fastapi

    if (!opts) result.warnings.push('FastAPI configuration is missing, using defaults.')

    const orm            = opts?.orm            ?? 'sqlmodel'
    const auth           = opts?.auth           ?? 'none'
    const migrations     = opts?.migrations     ?? true
    const useCors        = opts?.cors           ?? true
    const useSwagger     = opts?.swagger        ?? true
    const asyncMode      = opts?.async_mode     ?? true
    const architecture   = opts?.architecture   ?? 'layered'
    const pythonVersion  = opts?.python_version ?? '3.11'
    const useBgTasks     = opts?.background_tasks ?? false
    const useWebsockets  = opts?.websockets     ?? false
    const useRateLimiting = opts?.rate_limiting  ?? false
    const projectName    = config.name

    // requirements.txt
    const deps: string[] = ['fastapi', 'uvicorn[standard]', 'python-dotenv']
    if (orm === 'sqlmodel')     deps.push('sqlmodel')
    if (orm === 'sqlalchemy')   deps.push('sqlalchemy', 'alembic')
    if (orm === 'tortoise-orm') deps.push('tortoise-orm', 'aerich')
    if (orm === 'beanie')       deps.push('beanie', 'motor')
    if (auth !== 'none')        deps.push('python-jose[cryptography]', 'passlib[bcrypt]')
    if (opts?.db_engine === 'postgresql' && orm !== 'beanie') deps.push('psycopg2-binary')
    if (opts?.db_engine === 'mysql' && orm !== 'beanie')      deps.push('pymysql')
    if (useRateLimiting) deps.push('slowapi', 'limits')
    if (useWebsockets)   deps.push('websockets')

    result.files.push({ outputPath: 'requirements.txt', content: deps.join('\n') + '\n' })

    // pyproject.toml + .python-version
    result.files.push({ outputPath: 'pyproject.toml',    content: generatePyproject(projectName, pythonVersion) })
    result.files.push({ outputPath: '.python-version',   content: `${pythonVersion}\n` })

    // .env files
    const dbUrlDefault = orm === 'beanie'
      ? `mongodb://localhost:27017/${projectName}`
      : opts?.db_engine === 'mysql'
      ? `mysql+pymysql://user:password@localhost:3306/${projectName}`
      : `postgresql://user:password@localhost:5432/${projectName}`

    result.files.push({
      outputPath: '.env.example',
      content: [
        `DATABASE_URL="${dbUrlDefault}"`,
        ...(auth !== 'none' ? [`SECRET_KEY="change-me-in-production"`, `ACCESS_TOKEN_EXPIRE_MINUTES="30"`] : []),
      ].join('\n') + '\n',
    })
    result.files.push({
      outputPath: '.env',
      content: `DATABASE_URL="${dbUrlDefault}"\nSECRET_KEY="stack-init-dev-secret"\nACCESS_TOKEN_EXPIRE_MINUTES="30"\n`,
    })

    // database.py + app init
    result.files.push({ outputPath: 'app/database.py',  content: generateDatabase(orm, asyncMode) })
    result.files.push({ outputPath: 'app/__init__.py',  content: '' })

    // Optional modules
    if (useBgTasks)     result.files.push({ outputPath: 'app/tasks.py',     content: generateTasksModule() })
    if (useWebsockets)  result.files.push({ outputPath: 'app/websocket.py', content: generateWebSocketModule() })
    if (useRateLimiting) {
      result.files.push({ outputPath: 'app/core/__init__.py', content: '' })
      result.files.push({ outputPath: 'app/core/limiter.py',  content: generateLimiterModule() })
    }

    // main.py
    result.files.push({
      outputPath: 'app/main.py',
      content: generateMain(config, useCors, useSwagger, asyncMode, architecture, useWebsockets, useRateLimiting, useBgTasks),
    })

    // Architecture init files
    if (architecture === 'layered') {
      result.files.push({ outputPath: 'app/models/__init__.py',   content: '' })
      result.files.push({ outputPath: 'app/routers/__init__.py',  content: '' })
      result.files.push({ outputPath: 'app/services/__init__.py', content: '' })
    } else if (architecture === 'feature-based') {
      result.files.push({ outputPath: 'app/features/__init__.py', content: '' })
    } else if (architecture === 'domain') {
      result.files.push({ outputPath: 'app/domain/__init__.py', content: '' })
      result.files.push({ outputPath: 'app/api/__init__.py',    content: '' })
    }

    // Per-model files
    const sortedModels = sortModelsByDependency(config.models)
    const flatModelParts: string[] = []

    for (const model of sortedModels) {
      const gen      = model.generate ?? {}
      const mSnake   = modelToSnake(model.name)
      const canRoute = gen.routes !== false && gen.controller !== false
      const modelContent = generateModel(model, orm)

      if (architecture === 'flat') {
        flatModelParts.push(modelContent)
      } else if (architecture === 'layered') {
        result.files.push({ outputPath: `app/models/${mSnake}.py`,   content: modelContent, model: model.name })
        result.files.push({ outputPath: `app/services/${mSnake}.py`, content: generateService(model, orm, asyncMode, `app.models.${mSnake}`), model: model.name })
        if (canRoute)
          result.files.push({ outputPath: `app/routers/${mSnake}.py`, content: generateRouter(model, orm, asyncMode, `app.models.${mSnake}`, useBgTasks, useRateLimiting), model: model.name })
      } else if (architecture === 'feature-based') {
        result.files.push({ outputPath: `app/features/${mSnake}/__init__.py`, content: '', model: model.name })
        result.files.push({ outputPath: `app/features/${mSnake}/models.py`,   content: modelContent, model: model.name })
        result.files.push({ outputPath: `app/features/${mSnake}/service.py`,  content: generateService(model, orm, asyncMode, `app.features.${mSnake}.models`), model: model.name })
        if (canRoute)
          result.files.push({ outputPath: `app/features/${mSnake}/router.py`, content: generateRouter(model, orm, asyncMode, `app.features.${mSnake}.models`, useBgTasks, useRateLimiting), model: model.name })
      } else { // domain
        result.files.push({ outputPath: `app/domain/${mSnake}/__init__.py`, content: '', model: model.name })
        result.files.push({ outputPath: `app/api/${mSnake}/__init__.py`,    content: '', model: model.name })
        result.files.push({ outputPath: `app/domain/${mSnake}/entity.py`,   content: modelContent, model: model.name })
        result.files.push({ outputPath: `app/domain/${mSnake}/service.py`,  content: generateService(model, orm, asyncMode, `app.domain.${mSnake}.entity`), model: model.name })
        if (canRoute)
          result.files.push({ outputPath: `app/api/${mSnake}/router.py`, content: generateRouter(model, orm, asyncMode, `app.domain.${mSnake}.entity`, useBgTasks, useRateLimiting), model: model.name })
      }
    }

    if (architecture === 'flat') {
      result.files.push({ outputPath: 'app/models.py', content: flatModelParts.join('\n') })
      const routable = sortedModels.filter(m => m.generate?.routes !== false && m.generate?.controller !== false)
      if (routable.length > 0)
        result.files.push({ outputPath: 'app/routers.py', content: generateFlatRouters(routable, orm, asyncMode, useBgTasks, useRateLimiting) })
    }

    // Auth
    if (auth !== 'none') {
      const userModel = config.models.find(m => m.name.toLowerCase() === 'user')
      if (!userModel)
        result.warnings.push('Auth is enabled but no "User" model found. Add one or adjust auth files manually.')
      if (!useRateLimiting) result.files.push({ outputPath: 'app/core/__init__.py', content: '', model: userModel?.name ?? 'User' })
      result.files.push({ outputPath: 'app/core/security.py', content: generateAuthSecurity(), model: userModel?.name ?? 'User' })
      result.files.push({ outputPath: 'app/dependencies.py',  content: generateDependencies(orm), model: userModel?.name ?? 'User' })
      result.files.push({ outputPath: 'app/routers/auth.py',  content: generateAuthRouter(orm, asyncMode), model: userModel?.name ?? 'User' })
      if (architecture !== 'layered')
        result.files.push({ outputPath: 'app/routers/__init__.py', content: '', model: userModel?.name ?? 'User' })
    }

    // Alembic
    if (migrations && (orm === 'sqlalchemy' || orm === 'sqlmodel')) {
      result.files.push({ outputPath: 'alembic.ini',              content: generateAlembicIni(projectName) })
      result.files.push({ outputPath: 'alembic/env.py',           content: generateAlembicEnv(config, architecture) })
      result.files.push({ outputPath: 'alembic/versions/.gitkeep', content: '' })
    }

    // Runner
    if (!opts || opts.runner === 'makefile')
      result.files.push({ outputPath: 'Makefile', content: generateMakefile(asyncMode) })
    if (opts?.runner === 'bash')
      result.files.push({ outputPath: 'run.sh', content: `#!/bin/bash\nuvicorn app.main:app --reload\n` })

    return result
  }
}

// ─── New helper functions ──────────────────────────────────────────────────────

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

function generateTasksModule(): string {
  return `import logging

logger = logging.getLogger(__name__)


def send_welcome_email(email: str) -> None:
    """Background task — replace with real email sending logic."""
    logger.info("Sending welcome email to %s", email)


def process_data(data: dict) -> None:
    """Background task for data processing."""
    logger.info("Processing data: %s", data)
`
}

function generateWebSocketModule(): string {
  return `from fastapi import APIRouter, WebSocket, WebSocketDisconnect

ws_router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


@ws_router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"[{client_id}]: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
`
}

function generateLimiterModule(): string {
  return `from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
`
}

function generateService(model: Model, orm: string, asyncMode: boolean, modelImportPath: string): string {
  const mSnake = modelToSnake(model.name)
  const asyncKw = asyncMode ? 'async ' : ''
  const awaitKw = asyncMode ? 'await ' : ''

  if (orm === 'sqlmodel') {
    const sessionImport = asyncMode ? 'from sqlalchemy.ext.asyncio import AsyncSession' : 'from sqlmodel import Session'
    const sessionType   = asyncMode ? 'AsyncSession' : 'Session'
    const getAll  = asyncMode
      ? `(await session.execute(select(${model.name}).offset(offset).limit(limit))).scalars().all()`
      : `session.exec(select(${model.name}).offset(offset).limit(limit)).all()`
    const getOne  = asyncMode
      ? `(await session.execute(select(${model.name}).where(${model.name}.id == id))).scalar_one_or_none()`
      : `session.get(${model.name}, id)`
    const addCommit = asyncMode
      ? `session.add(item)\n    await session.commit()\n    await session.refresh(item)`
      : `session.add(item)\n    session.commit()\n    session.refresh(item)`
    const delCommit = asyncMode
      ? `await session.delete(item)\n    await session.commit()`
      : `session.delete(item)\n    session.commit()`

    return `from typing import Optional, List
from sqlmodel import select
${sessionImport}
from ${modelImportPath} import ${model.name}, ${model.name}Create, ${model.name}Update


${asyncKw}def get_${mSnake}s(session: ${sessionType}, offset: int = 0, limit: int = 100) -> List[${model.name}]:
    return ${awaitKw}${getAll}


${asyncKw}def get_${mSnake}(session: ${sessionType}, id: int) -> Optional[${model.name}]:
    return ${awaitKw}${getOne}


${asyncKw}def create_${mSnake}(session: ${sessionType}, data: ${model.name}Create) -> ${model.name}:
    item = ${model.name}.from_orm(data)
    ${addCommit}
    return item


${asyncKw}def update_${mSnake}(session: ${sessionType}, id: int, data: ${model.name}Update) -> Optional[${model.name}]:
    item = ${awaitKw}${getOne}
    if not item:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(item, key, value)
    ${addCommit}
    return item


${asyncKw}def delete_${mSnake}(session: ${sessionType}, id: int) -> bool:
    item = ${awaitKw}${getOne}
    if not item:
        return False
    ${delCommit}
    return True
`
  }

  if (orm === 'sqlalchemy') {
    return `from typing import Optional, List
from sqlalchemy.orm import Session
from ${modelImportPath} import ${model.name}


def get_${mSnake}s(db: Session, skip: int = 0, limit: int = 100) -> List[${model.name}]:
    return db.query(${model.name}).offset(skip).limit(limit).all()


def get_${mSnake}(db: Session, id: int) -> Optional[${model.name}]:
    return db.query(${model.name}).filter(${model.name}.id == id).first()


def create_${mSnake}(db: Session, data: dict) -> ${model.name}:
    item = ${model.name}(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_${mSnake}(db: Session, id: int, data: dict) -> Optional[${model.name}]:
    item = get_${mSnake}(db, id)
    if not item:
        return None
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_${mSnake}(db: Session, id: int) -> bool:
    item = get_${mSnake}(db, id)
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True
`
  }

  if (orm === 'beanie') {
    return `from typing import Optional, List
from ${modelImportPath} import ${model.name}


async def get_${mSnake}s() -> List[${model.name}]:
    return await ${model.name}.find_all().to_list()


async def get_${mSnake}(id: str) -> Optional[${model.name}]:
    return await ${model.name}.get(id)


async def create_${mSnake}(data: dict) -> ${model.name}:
    item = ${model.name}(**data)
    await item.insert()
    return item


async def update_${mSnake}(id: str, data: dict) -> Optional[${model.name}]:
    item = await ${model.name}.get(id)
    if not item:
        return None
    await item.set(data)
    return item


async def delete_${mSnake}(id: str) -> bool:
    item = await ${model.name}.get(id)
    if not item:
        return False
    await item.delete()
    return True
`
  }

  return `# Service layer for ${model.name} — implement business logic here\n`
}

function generateFlatRouters(models: Model[], orm: string, asyncMode: boolean, useBgTasks: boolean, useRateLimiting: boolean): string {
  if (orm === 'beanie') {
    const modelImports = models.map(m => `from app.models import ${m.name}`).join('\n')
    const routerBlocks = models.map(m => {
      const mSnake = modelToSnake(m.name)
      const mPlural = pluralize(mSnake)
      return `
${mSnake}_router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@${mSnake}_router.post("/", status_code=201)
async def create_${mSnake}(data: dict):
    item = ${m.name}(**data)
    await item.insert()
    return item

@${mSnake}_router.get("/")
async def read_${mPlural}():
    return await ${m.name}.find_all().to_list()

@${mSnake}_router.get("/{item_id}")
async def read_${mSnake}(item_id: str):
    item = await ${m.name}.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${m.name} not found")
    return item

@${mSnake}_router.patch("/{item_id}")
async def update_${mSnake}(item_id: str, data: dict):
    item = await ${m.name}.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${m.name} not found")
    await item.set(data)
    return item

@${mSnake}_router.delete("/{item_id}", status_code=204)
async def delete_${mSnake}(item_id: str):
    item = await ${m.name}.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${m.name} not found")
    await item.delete()`
    }).join('\n')
    return `from fastapi import APIRouter, HTTPException
${modelImports}
${routerBlocks}
`
  }

  const asyncKw = asyncMode ? 'async ' : ''
  const rateLimitImport = useRateLimiting ? `from fastapi import Request\nfrom app.core.limiter import limiter\n` : ''
  const bgTasksImport   = useBgTasks ? `from fastapi import BackgroundTasks\nfrom app.tasks import send_welcome_email\n` : ''

  const sessionImport = orm === 'sqlmodel' ? `from sqlmodel import Session, select` : `from sqlalchemy.orm import Session`
  const dbImport      = orm === 'sqlmodel' ? `from app.database import get_session` : `from app.database import get_db`
  const sessionParam  = orm === 'sqlmodel' ? `session: Session = Depends(get_session)` : `db: Session = Depends(get_db)`

  const modelImports = models.map(m => {
    if (orm === 'sqlmodel') return `from app.models import ${m.name}, ${m.name}Create, ${m.name}Read, ${m.name}Update`
    return `from app.models import ${m.name}`
  }).join('\n')

  const routerBlocks = models.map(m => {
    const mSnake = modelToSnake(m.name)
    const mPlural = pluralize(mSnake)
    const rateLimitDec = useRateLimiting ? `@limiter.limit("100/minute")\n` : ''
    const requestParam = useRateLimiting ? `request: Request, ` : ''
    const bgParam      = useBgTasks ? `, background_tasks: BackgroundTasks` : ''
    const bgCall       = useBgTasks ? `\n    background_tasks.add_task(send_welcome_email, "user@example.com")` : ''

    if (orm === 'sqlmodel') {
      return `
${mSnake}_router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@${mSnake}_router.post("/", response_model=${m.name}Read, status_code=201)
${asyncKw}def create_${mSnake}(*, ${sessionParam}, data: ${m.name}Create${bgParam}):
    item = ${m.name}.from_orm(data)
    session.add(item)
    session.commit()
    session.refresh(item)${bgCall}
    return item

${rateLimitDec}@${mSnake}_router.get("/", response_model=List[${m.name}Read])
${asyncKw}def read_${mPlural}(${requestParam}*, ${sessionParam}, offset: int = 0, limit: int = Query(default=100, le=100)):
    return session.exec(select(${m.name}).offset(offset).limit(limit)).all()

${rateLimitDec}@${mSnake}_router.get("/{item_id}", response_model=${m.name}Read)
${asyncKw}def read_${mSnake}(${requestParam}*, ${sessionParam}, item_id: int):
    item = session.get(${m.name}, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${m.name} not found")
    return item

@${mSnake}_router.patch("/{item_id}", response_model=${m.name}Read)
${asyncKw}def update_${mSnake}(*, ${sessionParam}, item_id: int, data: ${m.name}Update):
    item = session.get(${m.name}, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${m.name} not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@${mSnake}_router.delete("/{item_id}", status_code=204)
${asyncKw}def delete_${mSnake}(*, ${sessionParam}, item_id: int):
    item = session.get(${m.name}, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${m.name} not found")
    session.delete(item)
    session.commit()`
    }

    return `
${mSnake}_router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@${mSnake}_router.get("/")
${asyncKw}def read_${mPlural}(${requestParam}skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(${m.name}).offset(skip).limit(limit).all()`
  }).join('\n')

  return `from fastapi import APIRouter, Depends, HTTPException, Query
${rateLimitImport}${bgTasksImport}${sessionImport}
${dbImport}
from typing import List
${modelImports}
${routerBlocks}
`
}

// ─── Existing functions (updated signatures) ──────────────────────────────────

function generateDatabase(orm: string, _asyncMode: boolean): string {
  if (orm === 'sqlmodel') {
    return `import os
from sqlmodel import create_engine, SQLModel, Session
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
engine = create_engine(DATABASE_URL, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
`
  }
  if (orm === 'sqlalchemy') {
    return `import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
`
  }
  if (orm === 'beanie') {
    return `import os
import motor.motor_asyncio
from beanie import init_beanie
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://localhost:27017/app")


async def init_db(document_models: list):
    client = motor.motor_asyncio.AsyncIOMotorClient(DATABASE_URL)
    db = client.get_default_database()
    await init_beanie(database=db, document_models=document_models)
`
  }
  return `import os
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
`
}

function generateMain(
  config: ProjectConfig,
  useCors: boolean,
  useSwagger: boolean,
  _asyncMode: boolean,
  architecture: string,
  useWebsockets: boolean,
  useRateLimiting: boolean,
  useBgTasks: boolean,
): string {
  const opts  = config.fastapi
  const auth  = opts?.auth ?? 'none'
  const routable = config.models.filter(m => m.generate?.routes !== false && m.generate?.controller !== false)

  let routerImports: string[]
  let includeRouters: string[]

  switch (architecture) {
    case 'flat':
      routerImports  = routable.map(m => `from app.routers import ${modelToSnake(m.name)}_router`)
      includeRouters = routable.map(m => `app.include_router(${modelToSnake(m.name)}_router)`)
      break
    case 'feature-based':
      routerImports  = routable.map(m => `from app.features.${modelToSnake(m.name)}.router import router as ${modelToSnake(m.name)}_router`)
      includeRouters = routable.map(m => `app.include_router(${modelToSnake(m.name)}_router)`)
      break
    case 'domain':
      routerImports  = routable.map(m => `from app.api.${modelToSnake(m.name)}.router import router as ${modelToSnake(m.name)}_router`)
      includeRouters = routable.map(m => `app.include_router(${modelToSnake(m.name)}_router)`)
      break
    default: // layered
      routerImports  = routable.map(m => `from app.routers import ${modelToSnake(m.name)}`)
      includeRouters = routable.map(m => `app.include_router(${modelToSnake(m.name)}.router)`)
  }

  if (auth !== 'none') {
    routerImports.push(`from app.routers import auth as auth_router`)
    includeRouters.push(`app.include_router(auth_router.router, prefix="/auth", tags=["auth"])`)
  }

  const corsImport      = useCors ? 'from fastapi.middleware.cors import CORSMiddleware\n' : ''
  const corsMiddleware  = useCors ? `
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
` : ''

  const swaggerArgs = useSwagger ? '' : 'docs_url=None, redoc_url=None'

  const rateLimitImport = useRateLimiting
    ? 'from slowapi import _rate_limit_exceeded_handler\nfrom slowapi.errors import RateLimitExceeded\nfrom app.core.limiter import limiter\n'
    : ''
  const rateLimitSetup = useRateLimiting
    ? '\napp.state.limiter = limiter\napp.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)\n'
    : ''

  const wsImport  = useWebsockets ? 'from app.websocket import ws_router\n' : ''
  const wsInclude = useWebsockets ? '\napp.include_router(ws_router)' : ''

  const bgTasksImport = useBgTasks ? 'from app.tasks import send_welcome_email  # noqa: F401\n' : ''

  const ormName = opts?.orm ?? 'sqlmodel'

  let dbImport: string
  let ormSetup: string
  let lifespanDef: string
  let lifespanArg: string

  if (ormName === 'beanie') {
    const modelImports = config.models.map(m => {
      switch (architecture) {
        case 'flat':          return `from app.models import ${m.name}`
        case 'feature-based': return `from app.features.${modelToSnake(m.name)}.models import ${m.name}`
        case 'domain':        return `from app.domain.${modelToSnake(m.name)}.entity import ${m.name}`
        default:              return `from app.models.${modelToSnake(m.name)} import ${m.name}`
      }
    }).join('\n')
    dbImport = `from contextlib import asynccontextmanager\nfrom app.database import init_db\n${modelImports}\n`
    lifespanDef = `\n@asynccontextmanager\nasync def lifespan(app):\n    await init_db([${config.models.map(m => m.name).join(', ')}])\n    yield\n`
    lifespanArg = ', lifespan=lifespan'
    ormSetup = ''
  } else if (ormName === 'sqlmodel') {
    dbImport = 'from app.database import create_db_and_tables\n'
    ormSetup = `\n@app.on_event("startup")\ndef on_startup():\n    create_db_and_tables()\n`
    lifespanDef = ''
    lifespanArg = ''
  } else {
    dbImport = ''
    ormSetup = ''
    lifespanDef = ''
    lifespanArg = ''
  }

  const allImports = [corsImport, rateLimitImport, wsImport, bgTasksImport, dbImport, routerImports.join('\n')]
    .filter(Boolean).join('')

  return `from fastapi import FastAPI
${allImports}
${lifespanDef}
app = FastAPI(title="${config.name} API"${swaggerArgs ? ', ' + swaggerArgs : ''}${lifespanArg})
${corsMiddleware}${rateLimitSetup}${ormSetup}
${includeRouters.join('\n')}${wsInclude}

@app.get("/")
def read_root():
    return {"message": "Welcome to ${config.name} API"}
`
}

function generateModel(model: Model, orm: string): string {
  if (orm === 'sqlmodel') {
    const fieldLines = model.fields.map(raw => {
      const f = raw as AnyField
      const pyType    = toPythonType(f.type)
      const nullable  = f.nullable || false
      const typeStr   = nullable ? `Optional[${pyType}]` : pyType
      const defaultStr = nullable ? ' = None' : (f.default !== undefined ? ` = ${JSON.stringify(f.default)}` : '')
      return `    ${f.name}: ${typeStr}${defaultStr}`
    }).join('\n')

    return `from typing import Optional
from sqlmodel import Field, SQLModel

class ${model.name}Base(SQLModel):
${fieldLines || '    pass'}

class ${model.name}(${model.name}Base, table=True):
    __tablename__ = "${modelToTableName(model.name)}"
    id: Optional[int] = Field(default=None, primary_key=True)

class ${model.name}Create(${model.name}Base):
    pass

class ${model.name}Read(${model.name}Base):
    id: int

class ${model.name}Update(SQLModel):
${model.fields.map(raw => { const f = raw as AnyField; return `    ${f.name}: Optional[${toPythonType(f.type)}] = None` }).join('\n') || '    pass'}
`
  }

  if (orm === 'sqlalchemy') {
    const colLines = model.fields.map(raw => {
      const f = raw as AnyField
      const colType = toSAType(f.type)
      const nullable = f.nullable ? '' : ', nullable=False'
      return `    ${f.name} = Column(${colType}${nullable})`
    }).join('\n')

    return `from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime
from app.database import Base

class ${model.name}(Base):
    __tablename__ = "${modelToTableName(model.name)}"
    id = Column(Integer, primary_key=True, index=True)
${colLines || '    pass'}
`
  }

  if (orm === 'beanie') {
    const beanieFields = model.fields.map(raw => {
      const f = raw as AnyField
      const pyType = toPythonType(f.type)
      return f.nullable
        ? `    ${f.name}: Optional[${pyType}] = None`
        : `    ${f.name}: ${pyType}`
    }).join('\n')
    const tableName = modelToTableName(model.name)
    return `from typing import Optional
from beanie import Document

class ${model.name}(Document):
${beanieFields || '    pass'}

    class Settings:
        name = "${tableName}"
`
  }

  const fieldLines = model.fields.map(raw => { const f = raw as AnyField; return `    ${f.name}: ${toPythonType(f.type)}` }).join('\n')
  return `from pydantic import BaseModel
from typing import Optional

class ${model.name}(BaseModel):
    id: Optional[int] = None
${fieldLines || '    pass'}
`
}

function generateRouter(model: Model, orm: string, asyncMode: boolean, modelImportPath: string, useBgTasks: boolean, useRateLimiting: boolean): string {
  const mSnake  = modelToSnake(model.name)
  const mPlural = pluralize(mSnake)
  const asyncKw = asyncMode ? 'async ' : ''

  const rateLimitImport = useRateLimiting ? `from fastapi import Request\nfrom app.core.limiter import limiter\n` : ''
  const rateLimitDec    = useRateLimiting ? `@limiter.limit("100/minute")\n` : ''
  const requestParam    = useRateLimiting ? `request: Request, ` : ''

  const bgTasksImport = useBgTasks ? `from fastapi import BackgroundTasks\nfrom app.tasks import send_welcome_email\n` : ''
  const bgParam       = useBgTasks ? `, background_tasks: BackgroundTasks` : ''
  const bgCall        = useBgTasks ? `\n    background_tasks.add_task(send_welcome_email, "user@example.com")` : ''

  if (orm === 'sqlmodel') {
    return `from fastapi import APIRouter, Depends, HTTPException, Query
${rateLimitImport}${bgTasksImport}from sqlmodel import Session, select
from typing import List
from app.database import get_session
from ${modelImportPath} import ${model.name}, ${model.name}Create, ${model.name}Read, ${model.name}Update

router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@router.post("/", response_model=${model.name}Read, status_code=201)
${asyncKw}def create_${mSnake}(*, session: Session = Depends(get_session), data: ${model.name}Create${bgParam}):
    db_item = ${model.name}.from_orm(data)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)${bgCall}
    return db_item

${rateLimitDec}@router.get("/", response_model=List[${model.name}Read])
${asyncKw}def read_${mPlural}(${requestParam}*, session: Session = Depends(get_session), offset: int = 0, limit: int = Query(default=100, le=100)):
    items = session.exec(select(${model.name}).offset(offset).limit(limit)).all()
    return items

${rateLimitDec}@router.get("/{item_id}", response_model=${model.name}Read)
${asyncKw}def read_${mSnake}(${requestParam}*, session: Session = Depends(get_session), item_id: int):
    item = session.get(${model.name}, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    return item

@router.patch("/{item_id}", response_model=${model.name}Read)
${asyncKw}def update_${mSnake}(*, session: Session = Depends(get_session), item_id: int, data: ${model.name}Update):
    item = session.get(${model.name}, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/{item_id}", status_code=204)
${asyncKw}def delete_${mSnake}(*, session: Session = Depends(get_session), item_id: int):
    item = session.get(${model.name}, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    session.delete(item)
    session.commit()
`
  }

  if (orm === 'sqlalchemy') {
    return `from fastapi import APIRouter, Depends, HTTPException
${rateLimitImport}${bgTasksImport}from sqlalchemy.orm import Session
from typing import List, Any
from app.database import get_db
from ${modelImportPath} import ${model.name}

router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

${rateLimitDec}@router.get("/", response_model=List[Any])
${asyncKw}def read_${mPlural}(${requestParam}skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(${model.name}).offset(skip).limit(limit).all()

${rateLimitDec}@router.get("/{item_id}")
${asyncKw}def read_${mSnake}(${requestParam}item_id: int, db: Session = Depends(get_db)):
    item = db.query(${model.name}).filter(${model.name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    return item

@router.post("/", status_code=201)
${asyncKw}def create_${mSnake}(data: dict, db: Session = Depends(get_db)${bgParam}):
    item = ${model.name}(**data)
    db.add(item)
    db.commit()
    db.refresh(item)${bgCall}
    return item

@router.patch("/{item_id}")
${asyncKw}def update_${mSnake}(item_id: int, data: dict, db: Session = Depends(get_db)):
    item = db.query(${model.name}).filter(${model.name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}", status_code=204)
${asyncKw}def delete_${mSnake}(item_id: int, db: Session = Depends(get_db)):
    item = db.query(${model.name}).filter(${model.name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    db.delete(item)
    db.commit()
`
  }

  if (orm === 'beanie') {
    return `from fastapi import APIRouter, HTTPException
from ${modelImportPath} import ${model.name}

router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@router.post("/", status_code=201)
async def create_${mSnake}(data: dict):
    item = ${model.name}(**data)
    await item.insert()
    return item

@router.get("/")
async def read_${mPlural}():
    return await ${model.name}.find_all().to_list()

@router.get("/{item_id}")
async def read_${mSnake}(item_id: str):
    item = await ${model.name}.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    return item

@router.patch("/{item_id}")
async def update_${mSnake}(item_id: str, data: dict):
    item = await ${model.name}.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    await item.set(data)
    return item

@router.delete("/{item_id}", status_code=204)
async def delete_${mSnake}(item_id: str):
    item = await ${model.name}.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    await item.delete()
`
  }

  return `from fastapi import APIRouter
router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])
`
}

function toSAType(type: string): string {
  const map: Record<string, string> = {
    string: 'String', char: 'String',
    text: 'Text', tinyText: 'Text', mediumText: 'Text', longText: 'Text',
    integer: 'Integer', bigInteger: 'BigInteger',
    smallInteger: 'SmallInteger', tinyInteger: 'SmallInteger', mediumInteger: 'Integer',
    unsignedInteger: 'Integer', unsignedBigInteger: 'BigInteger',
    unsignedTinyInteger: 'SmallInteger', unsignedSmallInteger: 'SmallInteger',
    unsignedMediumInteger: 'Integer',
    boolean: 'Boolean',
    float: 'Float', double: 'Float', decimal: 'Numeric',
    date: 'Date', dateTime: 'DateTime', dateTimeTz: 'DateTime',
    timestamp: 'DateTime', timestampTz: 'DateTime',
    time: 'Time', timeTz: 'Time',
    json: 'Text', jsonb: 'Text',
    uuid: 'String', ulid: 'String',
    foreignId: 'Integer', foreignUuid: 'String', foreignUlid: 'String',
    binary: 'LargeBinary', enum: 'String',
  }
  return map[type] ?? 'String'
}

function generateAlembicIni(projectName: string): string {
  return `[alembic]
script_location = alembic
sqlalchemy.url = driver://user:pass@localhost/${projectName}

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
`
}

function generateAlembicEnv(config: ProjectConfig, architecture: string): string {
  const orm = config.fastapi?.orm ?? 'sqlmodel'

  let modelImports: string
  switch (architecture) {
    case 'flat':
      modelImports = `from app.models import ${config.models.map(m => m.name).join(', ')}`
      break
    case 'feature-based':
      modelImports = config.models.map(m => `from app.features.${modelToSnake(m.name)}.models import ${m.name}`).join('\n')
      break
    case 'domain':
      modelImports = config.models.map(m => `from app.domain.${modelToSnake(m.name)}.entity import ${m.name}`).join('\n')
      break
    default:
      modelImports = config.models.map(m => `from app.models.${modelToSnake(m.name)} import ${m.name}`).join('\n')
  }

  const metadataImport  = orm === 'sqlmodel' ? 'from sqlmodel import SQLModel' : 'from app.database import Base'
  const targetMetadata  = orm === 'sqlmodel' ? 'SQLModel.metadata' : 'Base.metadata'

  return `import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

load_dotenv()

${modelImports}

${metadataImport}

config = context.config
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL", "sqlite:///./dev.db"))
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = ${targetMetadata}

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
`
}

function generateMakefile(_asyncMode: boolean): string {
  return `dev:
\tuvicorn app.main:app --reload

install:
\tpip install -r requirements.txt

migrate:
\talembic upgrade head

makemigrations:
\talembic revision --autogenerate -m "auto"

test:
\tpytest
`
}

function generateAuthSecurity(): string {
  return `import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
`
}

function generateDependencies(orm: string): string {
  const sessionDep   = orm === 'sqlmodel'
    ? `from app.database import get_session\nfrom sqlmodel import Session`
    : `from app.database import get_db\nfrom sqlalchemy.orm import Session`
  const sessionParam = orm === 'sqlmodel' ? `Session = Depends(get_session)` : `db: Session = Depends(get_db)`
  const userQuery    = orm === 'sqlmodel'
    ? `user = session.get(User, payload.get("sub"))`
    : `user = db.query(User).filter(User.id == payload.get("sub")).first()`

  return `from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
${sessionDep}
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), ${sessionParam}) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    ${userQuery}
    if user is None:
        raise credentials_exception
    return user
`
}

function generateAuthRouter(orm: string, asyncMode: boolean): string {
  const asyncKw     = asyncMode ? 'async ' : ''
  const sessionDep  = orm === 'sqlmodel'
    ? `from app.database import get_session\nfrom sqlmodel import Session, select`
    : `from app.database import get_db\nfrom sqlalchemy.orm import Session`
  const sessionParam   = orm === 'sqlmodel' ? `session: Session = Depends(get_session)` : `db: Session = Depends(get_db)`
  const findByEmail    = orm === 'sqlmodel'
    ? `session.exec(select(User).where(User.email == data.username)).first()`
    : `db.query(User).filter(User.email == data.username).first()`
  const createUser     = orm === 'sqlmodel'
    ? `session.add(new_user)\n    session.commit()\n    session.refresh(new_user)`
    : `db.add(new_user)\n    db.commit()\n    db.refresh(new_user)`
  const checkExisting  = orm === 'sqlmodel'
    ? `session.exec(select(User).where(User.email == body.email)).first()`
    : `db.query(User).filter(User.email == body.email).first()`

  return `from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
${sessionDep}
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token
from app.dependencies import get_current_user

router = APIRouter()


class RegisterBody(BaseModel):
    name: str
    email: str
    password: str


@router.post("/register", status_code=201)
${asyncKw}def register(body: RegisterBody, ${sessionParam}):
    existing = ${checkExisting}
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")
    new_user = User(name=body.name, email=body.email, password=hash_password(body.password))
    ${createUser}
    return {"message": "Account created", "user": {"id": new_user.id, "name": new_user.name, "email": new_user.email}}


@router.post("/login")
${asyncKw}def login(form: OAuth2PasswordRequestForm = Depends(), ${sessionParam}):
    user = ${findByEmail}
    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
${asyncKw}def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email}
`
}
