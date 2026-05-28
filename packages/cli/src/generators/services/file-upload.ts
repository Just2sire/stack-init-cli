import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateFileUpload(config: ProjectConfig, files: GeneratedFile[]): void {
  const stack = config.stack as string

  if (stack.includes('laravel')) {
    files.push({
      outputPath: 'app/Http/Controllers/UploadController.php',
      content: `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Storage;

class UploadController extends Controller
{
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:10240',
        ]);

        $path = $request->file('file')->store('uploads', 'public');

        return response()->json([
            'path'  => $path,
            'url'   => Storage::url($path),
        ]);
    }

    public function delete(string $path): JsonResponse
    {
        Storage::disk('public')->delete($path);
        return response()->json(['deleted' => true]);
    }
}
`,
    })

    files.push({
      outputPath: '.env.storage.example',
      content: `FILESYSTEM_DISK=local
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false
`,
    })
    return
  }

  if (stack.includes('nestjs')) {
    files.push({
      outputPath: 'src/upload/upload.module.ts',
      content: `import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { UploadController } from './upload.controller'

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
          cb(null, unique + extname(file.originalname))
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
`,
    })

    files.push({
      outputPath: 'src/upload/upload.controller.ts',
      content: `import { Controller, Post, UploadedFile, UseInterceptors, Delete, Param } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Express } from 'express'
import fs from 'fs'
import path from 'path'

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { filename: file.filename, path: \`/uploads/\${file.filename}\` }
  }

  @Delete(':filename')
  delete(@Param('filename') filename: string) {
    fs.unlinkSync(path.join('./uploads', filename))
    return { deleted: true }
  }
}
`,
    })
    return
  }

  if (stack.includes('fastapi')) {
    files.push({
      outputPath: 'app/routers/upload.py',
      content: `import os
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/")
async def upload_file(file: UploadFile = File(...)) -> JSONResponse:
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = Path(file.filename or "file").suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(contents)

    return JSONResponse({"filename": filename, "url": f"/uploads/{filename}"})


@router.delete("/{filename}")
async def delete_file(filename: str) -> JSONResponse:
    dest = UPLOAD_DIR / filename
    if not dest.exists():
        raise HTTPException(status_code=404, detail="File not found")
    os.remove(dest)
    return JSONResponse({"deleted": True})
`,
    })
    return
  }

  // Express (multer)
  files.push({
    outputPath: 'src/middleware/upload.ts',
    content: `import multer from 'multer'
import path from 'path'
import { mkdirSync } from 'fs'

mkdirSync('uploads', { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + path.extname(file.originalname))
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
})
`,
  })

  files.push({
    outputPath: 'src/routes/upload.route.ts',
    content: `import { Router, Request, Response } from 'express'
import { upload } from '../middleware/upload'
import fs from 'fs'
import path from 'path'

const router = Router()

router.post('/', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ filename: req.file.filename, path: \`/uploads/\${req.file.filename}\` })
})

router.delete('/:filename', (req: Request, res: Response) => {
  const filePath = path.join('uploads', req.params.filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
  fs.unlinkSync(filePath)
  res.json({ deleted: true })
})

export default router
`,
  })
}
