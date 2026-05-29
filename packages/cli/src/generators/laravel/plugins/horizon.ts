import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'

export function generateHorizon(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''
  const name   = config.name

  files.push({
    outputPath: 'config/horizon.php',
    content: `<?php

use Illuminate\\Support\\Str;

return [
    'domain'  => env('HORIZON_DOMAIN'),
    'path'    => env('HORIZON_PATH', 'horizon'),
    'use'     => 'default',
    'prefix'  => env('HORIZON_PREFIX', Str::slug(env('APP_NAME', '${name}'), '_') . '_horizon:'),
    'middleware' => ['web'],
    'waits'      => ['redis:default' => 60],
    'trim'    => [
        'recent'        => 60,
        'pending'       => 60,
        'completed'     => 60,
        'recent_failed' => 10080,
        'failed'        => 10080,
        'monitored'     => 10080,
    ],
    'silenced' => [],
    'metrics'  => ['trim_snapshots' => ['job' => 24, 'queue' => 24]],
    'fast_termination' => false,
    'memory_limit'     => 64,
    'defaults' => [
        'supervisor-1' => [
            'connection' => 'redis',
            'queue'      => ['default'],
            'balance'    => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => 1,
            'maxTime'      => 0,
            'maxJobs'      => 0,
            'memory'       => 128,
            'tries'        => 1,
            'timeout'      => 60,
            'nice'         => 0,
        ],
    ],
    'environments' => [
        'production' => [
            'supervisor-1' => ['maxProcesses' => 10, 'balanceMaxShift' => 1, 'balanceCooldown' => 3],
        ],
        'local' => [
            'supervisor-1' => ['maxProcesses' => 3],
        ],
    ],
];
`,
  })

  files.push({
    outputPath: 'app/Providers/HorizonServiceProvider.php',
    content: `<?php
${strict}
namespace App\\Providers;

use Illuminate\\Support\\Facades\\Gate;
use Laravel\\Horizon\\Horizon;
use Laravel\\Horizon\\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    public function boot(): void
    {
        parent::boot();

        Horizon::routeMailNotificationsTo('');
        Horizon::routeSlackNotificationsTo('', '#horizon');
    }

    protected function gate(): void
    {
        Gate::define('viewHorizon', function ($user = null) {
            // Restrict dashboard to specific emails in production
            return in_array(optional($user)->email, [
                // 'admin@example.com',
            ]);
        });
    }
}
`,
  })

  const laravelVer = parseInt(config.laravel?.laravel_version ?? '11')
  const regNote = laravelVer >= 11
    ? 'Add App\\Providers\\HorizonServiceProvider::class to bootstrap/providers.php.'
    : 'Add App\\Providers\\HorizonServiceProvider::class to the providers array in config/app.php.'

  warnings.push(
    'Laravel Horizon: run `composer require laravel/horizon`. ' +
    'Install: `php artisan horizon:install && php artisan horizon:publish`. ' +
    regNote + ' ' +
    'Requires use_redis: true — make sure Redis is running. ' +
    'Access the dashboard at /horizon (gated by HorizonServiceProvider::gate()).'
  )
}
