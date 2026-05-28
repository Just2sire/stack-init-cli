import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateCache(config: ProjectConfig, files: GeneratedFile[]): void {
  const stack = config.stack as string

  if (stack.includes('laravel')) {
    files.push({
      outputPath: '.env.redis.example',
      content: `REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
`,
    })

    files.push({
      outputPath: 'app/Http/Controllers/CacheExampleController.php',
      content: `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\JsonResponse;
use Illuminate\\Support\\Facades\\Cache;

class CacheExampleController extends Controller
{
    public function get(string $key): JsonResponse
    {
        $value = Cache::get($key);
        return response()->json(['key' => $key, 'value' => $value]);
    }

    public function set(string $key, string $value): JsonResponse
    {
        Cache::put($key, $value, now()->addMinutes(60));
        return response()->json(['stored' => true]);
    }

    public function forget(string $key): JsonResponse
    {
        Cache::forget($key);
        return response()->json(['deleted' => true]);
    }
}
`,
    })
    return
  }

  if (stack.includes('nestjs')) {
    files.push({
      outputPath: 'src/cache/cache.module.ts',
      content: `import { Module } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD ?? undefined,
        }),
        ttl: 60,
      }),
    }),
  ],
})
export class AppCacheModule {}
`,
    })

    files.push({
      outputPath: '.env.redis.example',
      content: `REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
`,
    })
    return
  }

  if (stack.includes('fastapi')) {
    files.push({
      outputPath: 'app/core/cache.py',
      content: `from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
import redis.asyncio as aioredis
import os


async def init_cache() -> None:
    redis = aioredis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"),
        encoding="utf8",
        decode_responses=True,
    )
    FastAPICache.init(RedisBackend(redis), prefix="${config.name}-cache")
`,
    })

    files.push({
      outputPath: 'app/services/cache.py',
      content: `from fastapi_cache.decorator import cache


@cache(expire=60)
async def get_cached_data(key: str) -> dict:
    """Example cached function — replace with real logic."""
    return {"key": key, "data": "computed_value"}
`,
    })

    files.push({
      outputPath: '.env.redis.example',
      content: `REDIS_URL=redis://localhost:6379
`,
    })
    return
  }

  // Express (default)
  files.push({
    outputPath: 'src/config/redis.ts',
    content: `import Redis from 'ioredis'

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD ?? undefined,
})

redis.on('error', (err) => console.error('Redis error:', err))
`,
  })

  files.push({
    outputPath: 'src/services/cache.service.ts',
    content: `import { redis } from '../config/redis'

export async function get<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key)
  return raw ? (JSON.parse(raw) as T) : null
}

export async function set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function del(key: string): Promise<void> {
  await redis.del(key)
}
`,
  })

  files.push({
    outputPath: '.env.redis.example',
    content: `REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
`,
  })
}
