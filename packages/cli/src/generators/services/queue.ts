import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateQueue(config: ProjectConfig, files: GeneratedFile[]): void {
  const stack = config.stack as string

  if (stack.includes('laravel')) {
    files.push({
      outputPath: 'app/Jobs/ExampleJob.php',
      content: `<?php

namespace App\\Jobs;

use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Foundation\\Bus\\Dispatchable;
use Illuminate\\Queue\\InteractsWithQueue;
use Illuminate\\Queue\\SerializesModels;
use Illuminate\\Support\\Facades\\Log;

class ExampleJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;

    public function __construct(public readonly array $payload) {}

    public function handle(): void
    {
        Log::info('ExampleJob processing', $this->payload);
        // TODO: Add your job logic here
    }

    public function failed(\\Throwable $exception): void
    {
        Log::error('ExampleJob failed', ['error' => $exception->getMessage()]);
    }
}
`,
    })

    files.push({
      outputPath: '.env.queue.example',
      content: `QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
`,
    })
    return
  }

  if (stack.includes('nestjs')) {
    files.push({
      outputPath: 'src/jobs/jobs.module.ts',
      content: `import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ExampleProcessor } from './example.processor'

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    BullModule.registerQueue({ name: 'example' }),
  ],
  providers: [ExampleProcessor],
  exports: [BullModule],
})
export class JobsModule {}
`,
    })

    files.push({
      outputPath: 'src/jobs/example.processor.ts',
      content: `import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'

@Processor('example')
export class ExampleProcessor extends WorkerHost {
  async process(job: Job<{ message: string }>): Promise<void> {
    console.log(\`Processing job \${job.id}:\`, job.data)
    // TODO: Add your processing logic here
  }
}
`,
    })

    files.push({
      outputPath: '.env.queue.example',
      content: `REDIS_HOST=127.0.0.1
REDIS_PORT=6379
`,
    })
    return
  }

  if (stack.includes('fastapi')) {
    files.push({
      outputPath: 'app/tasks/celery.py',
      content: `from celery import Celery
import os

celery_app = Celery(
    "${config.name}",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
    include=["app.tasks.example"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
`,
    })

    files.push({
      outputPath: 'app/tasks/example.py',
      content: `from app.tasks.celery import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def example_task(self, payload: dict) -> dict:
    """Example Celery task — replace with real logic."""
    logger.info("Processing task with payload: %s", payload)
    # TODO: Add your task logic here
    return {"status": "done", "payload": payload}
`,
    })

    files.push({
      outputPath: '.env.queue.example',
      content: `CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
`,
    })
    return
  }

  // Express (BullMQ)
  files.push({
    outputPath: 'src/queues/example.queue.ts',
    content: `import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
})

export const exampleQueue = new Queue('example', { connection })

export async function addExampleJob(data: Record<string, unknown>): Promise<void> {
  await exampleQueue.add('process', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } })
}
`,
  })

  files.push({
    outputPath: 'src/workers/example.worker.ts',
    content: `import { Worker } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
})

const worker = new Worker(
  'example',
  async (job) => {
    console.log(\`Processing job \${job.id}:\`, job.data)
    // TODO: Add your worker logic here
  },
  { connection },
)

worker.on('completed', (job) => console.log(\`Job \${job.id} completed\`))
worker.on('failed', (job, err) => console.error(\`Job \${job?.id} failed:\`, err))

export default worker
`,
  })

  files.push({
    outputPath: '.env.queue.example',
    content: `REDIS_HOST=127.0.0.1
REDIS_PORT=6379
`,
  })
}
