import type { Model, ProjectConfig } from '@stack-init/schema'
import { snakeCase, pluralize, modelToTableName } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'

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
    enum: 'str',
    binary: 'bytes',
    json_: 'dict',
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

    if (!opts) {
      result.warnings.push('FastAPI configuration is missing, using defaults.')
    }

    const orm = opts?.orm ?? 'sqlmodel'
    const auth = opts?.auth ?? 'none'
    const migrations = opts?.migrations ?? true
    const useCors = opts?.cors ?? true
    const useSwagger = opts?.swagger ?? true
    const asyncMode = opts?.async_mode ?? true
    const projectName = config.name

    // requirements.txt
    const deps: string[] = ['fastapi', 'uvicorn[standard]', 'python-dotenv']
    if (orm === 'sqlmodel') deps.push('sqlmodel')
    if (orm === 'sqlalchemy') deps.push('sqlalchemy', 'alembic')
    if (orm === 'tortoise-orm') deps.push('tortoise-orm', 'aerich')
    if (auth !== 'none') deps.push('python-jose[cryptography]', 'passlib[bcrypt]')
    if (opts?.db_engine === 'postgresql') deps.push('psycopg2-binary')
    if (opts?.db_engine === 'mysql') deps.push('pymysql')
    if (opts?.rate_limiting) deps.push('slowapi')

    result.files.push({ outputPath: 'requirements.txt', content: deps.join('\n') + '\n' })

    // .env files
    const dbUrlDefault = opts?.db_engine === 'mysql'
      ? `mysql+pymysql://user:password@localhost:3306/${projectName}`
      : `postgresql://user:password@localhost:5432/${projectName}`

    const envExampleLines = [
      `DATABASE_URL="${dbUrlDefault}"`,
      ...(auth !== 'none' ? [
        `SECRET_KEY="change-me-in-production"`,
        `ACCESS_TOKEN_EXPIRE_MINUTES="30"`,
      ] : []),
    ]
    result.files.push({ outputPath: '.env.example', content: envExampleLines.join('\n') + '\n' })
    result.files.push({ outputPath: '.env', content: `DATABASE_URL="${dbUrlDefault}"\nSECRET_KEY="stack-init-dev-secret"\nACCESS_TOKEN_EXPIRE_MINUTES="30"\n` })

    // database.py
    result.files.push({ outputPath: 'app/database.py', content: generateDatabase(orm, asyncMode) })

    // main.py
    result.files.push({ outputPath: 'app/main.py', content: generateMain(config, useCors, useSwagger, asyncMode) })

    // __init__.py files
    result.files.push({ outputPath: 'app/__init__.py', content: '' })
    result.files.push({ outputPath: 'app/models/__init__.py', content: '' })
    result.files.push({ outputPath: 'app/routers/__init__.py', content: '' })

    // Per-model files
    for (const model of config.models) {
      const gen = model.generate ?? {}
      const mSnake = modelToSnake(model.name)

      // Model file
      result.files.push({
        outputPath: `app/models/${mSnake}.py`,
        content: generateModel(model, orm),
      })

      // Router file
      if (gen.routes !== false && gen.controller !== false) {
        result.files.push({
          outputPath: `app/routers/${mSnake}.py`,
          content: generateRouter(model, orm, asyncMode),
        })
      }
    }

    // Auth service generation
    if (auth !== 'none') {
      const hasUserModel = config.models.some(m => m.name.toLowerCase() === 'user')
      if (!hasUserModel) {
        result.warnings.push('Auth is enabled but no "User" model found. The auth router references a User model — add one or adjust auth files manually.')
      }
      result.files.push({ outputPath: 'app/core/__init__.py',  content: '' })
      result.files.push({ outputPath: 'app/core/security.py',  content: generateAuthSecurity() })
      result.files.push({ outputPath: 'app/dependencies.py',   content: generateDependencies(orm) })
      result.files.push({ outputPath: 'app/routers/auth.py',   content: generateAuthRouter(orm, asyncMode) })
    }

    // Alembic scaffold (if sqlalchemy + migrations)
    if (migrations && (orm === 'sqlalchemy' || orm === 'sqlmodel')) {
      result.files.push({ outputPath: 'alembic.ini', content: generateAlembicIni(projectName) })
      result.files.push({ outputPath: 'alembic/env.py', content: generateAlembicEnv(config) })
      result.files.push({ outputPath: 'alembic/versions/.gitkeep', content: '' })
    }

    // Makefile
    if (!opts || opts.runner === 'makefile') {
      result.files.push({ outputPath: 'Makefile', content: generateMakefile(asyncMode) })
    }
    if (opts?.runner === 'bash') {
      result.files.push({ outputPath: 'run.sh', content: `#!/bin/bash\nuvicorn app.main:app --reload\n` })
    }

    return result
  }
}

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
  return `import os
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
`
}

function generateMain(config: ProjectConfig, useCors: boolean, useSwagger: boolean, _asyncMode: boolean): string {
  const opts = config.fastapi
  const models = config.models
  const auth = opts?.auth ?? 'none'
  const routerImports = [
    ...models
      .filter(m => (m.generate?.routes !== false) && (m.generate?.controller !== false))
      .map(m => `from app.routers import ${modelToSnake(m.name)}`),
    ...(auth !== 'none' ? [`from app.routers import auth as auth_router`] : []),
  ].join('\n')
  const includeRouters = [
    ...models
      .filter(m => (m.generate?.routes !== false) && (m.generate?.controller !== false))
      .map(m => `app.include_router(${modelToSnake(m.name)}.router)`),
    ...(auth !== 'none' ? [`app.include_router(auth_router.router, prefix="/auth", tags=["auth"])`] : []),
  ].join('\n')

  const ormSetup = opts?.orm === 'sqlmodel'
    ? `\n@app.on_event("startup")\ndef on_startup():\n    create_db_and_tables()\n`
    : ''
  const dbImport = opts?.orm === 'sqlmodel'
    ? 'from app.database import create_db_and_tables\n'
    : ''

  const corsMiddleware = useCors ? `
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
` : ''
  const corsImport = useCors ? 'from fastapi.middleware.cors import CORSMiddleware\n' : ''

  const swaggerArgs = useSwagger ? '' : 'docs_url=None, redoc_url=None'

  return `from fastapi import FastAPI
${corsImport}${dbImport}${routerImports}

app = FastAPI(title="${config.name} API"${swaggerArgs ? ', ' + swaggerArgs : ''})
${corsMiddleware}
${ormSetup}
${includeRouters}

@app.get("/")
def read_root():
    return {"message": "Welcome to ${config.name} API"}
`
}

function generateModel(model: Model, orm: string): string {
  if (orm === 'sqlmodel') {
    const fieldLines = model.fields.map(raw => {
      const f = raw as AnyField
      const pyType = toPythonType(f.type)
      const nullable = f.nullable || false
      const typeStr = nullable ? `Optional[${pyType}]` : pyType
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

  // Fallback: simple dataclass-style
  const fieldLines = model.fields.map(raw => { const f = raw as AnyField; return `    ${f.name}: ${toPythonType(f.type)}` }).join('\n')
  return `from pydantic import BaseModel
from typing import Optional

class ${model.name}(BaseModel):
    id: Optional[int] = None
${fieldLines || '    pass'}
`
}

function generateRouter(model: Model, orm: string, asyncMode: boolean): string {
  const mSnake = modelToSnake(model.name)
  const mPlural = pluralize(mSnake)
  const asyncKw = asyncMode ? 'async ' : ''

  if (orm === 'sqlmodel') {
    return `from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List
from app.database import get_session
from app.models.${mSnake} import ${model.name}, ${model.name}Create, ${model.name}Read, ${model.name}Update

router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@router.post("/", response_model=${model.name}Read, status_code=201)
${asyncKw}def create_${mSnake}(*, session: Session = Depends(get_session), data: ${model.name}Create):
    db_item = ${model.name}.from_orm(data)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.get("/", response_model=List[${model.name}Read])
${asyncKw}def read_${mPlural}(*, session: Session = Depends(get_session), offset: int = 0, limit: int = Query(default=100, le=100)):
    items = session.exec(select(${model.name}).offset(offset).limit(limit)).all()
    return items

@router.get("/{item_id}", response_model=${model.name}Read)
${asyncKw}def read_${mSnake}(*, session: Session = Depends(get_session), item_id: int):
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
from sqlalchemy.orm import Session
from typing import List, Any
from app.database import get_db
from app.models.${mSnake} import ${model.name}

router = APIRouter(prefix="/${mPlural}", tags=["${mPlural}"])

@router.get("/", response_model=List[Any])
${asyncKw}def read_${mPlural}(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(${model.name}).offset(skip).limit(limit).all()

@router.get("/{item_id}")
${asyncKw}def read_${mSnake}(item_id: int, db: Session = Depends(get_db)):
    item = db.query(${model.name}).filter(${model.name}.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="${model.name} not found")
    return item

@router.post("/", status_code=201)
${asyncKw}def create_${mSnake}(data: dict, db: Session = Depends(get_db)):
    item = ${model.name}(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
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

  // Fallback
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
    binary: 'LargeBinary',
    enum: 'String',
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

function generateAlembicEnv(config: ProjectConfig): string {
  const orm = config.fastapi?.orm ?? 'sqlmodel'
  const modelImports = config.models.map(m => `from app.models.${modelToSnake(m.name)} import ${m.name}`).join('\n')
  const metadataImport = orm === 'sqlmodel'
    ? 'from sqlmodel import SQLModel'
    : 'from app.database import Base'
  const targetMetadata = orm === 'sqlmodel' ? 'SQLModel.metadata' : 'Base.metadata'

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
  const sessionDep = orm === 'sqlmodel'
    ? `from app.database import get_session
from sqlmodel import Session`
    : `from app.database import get_db
from sqlalchemy.orm import Session`

  const sessionParam = orm === 'sqlmodel' ? `Session = Depends(get_session)` : `db: Session = Depends(get_db)`
  const userQuery = orm === 'sqlmodel'
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
  const asyncKw = asyncMode ? 'async ' : ''
  const sessionDep = orm === 'sqlmodel'
    ? `from app.database import get_session\nfrom sqlmodel import Session, select`
    : `from app.database import get_db\nfrom sqlalchemy.orm import Session`

  const sessionParam = orm === 'sqlmodel' ? `session: Session = Depends(get_session)` : `db: Session = Depends(get_db)`

  const findByEmail = orm === 'sqlmodel'
    ? `session.exec(select(User).where(User.email == data.username)).first()`
    : `db.query(User).filter(User.email == data.username).first()`

  const createUser = orm === 'sqlmodel'
    ? `session.add(new_user)\n    session.commit()\n    session.refresh(new_user)`
    : `db.add(new_user)\n    db.commit()\n    db.refresh(new_user)`

  const checkExisting = orm === 'sqlmodel'
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
