import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'

export function generateSpatieActivity(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''

  files.push({
    outputPath: 'app/Http/Controllers/ActivityController.php',
    content: `<?php
${strict}
namespace App\\Http\\Controllers;

use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Spatie\\Activitylog\\Models\\Activity;

class ActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $activities = Activity::with('causer', 'subject')
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($activities);
    }

    public function forModel(Request $request, string $modelClass, int $modelId): JsonResponse
    {
        $activities = Activity::forSubject(app($modelClass)->findOrFail($modelId))
            ->with('causer')
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($activities);
    }

    public function forUser(int $userId): JsonResponse
    {
        $activities = Activity::causedBy(
            \\App\\Models\\User::findOrFail($userId)
        )->latest()->paginate(25);

        return response()->json($activities);
    }
}
`,
  })

  files.push({
    outputPath: 'routes/activity.php',
    content: `<?php

use App\\Http\\Controllers\\ActivityController;
use Illuminate\\Support\\Facades\\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('activity',                          [ActivityController::class, 'index']);
    Route::get('activity/{modelClass}/{modelId}',   [ActivityController::class, 'forModel']);
    Route::get('activity/user/{userId}',            [ActivityController::class, 'forUser']);
});
`,
  })

  const modelList = config.models.map(m => `// - ${m.name}: add LogsActivity trait`).join('\n')

  warnings.push(
    'Spatie Activity Log: run `composer require spatie/laravel-activitylog`. ' +
    'Publish & migrate: `php artisan vendor:publish --provider="Spatie\\\\Activitylog\\\\ActivitylogServiceProvider" --tag="activitylog-migrations" && php artisan migrate`. ' +
    'Add LogsActivity trait to your models:\n' + modelList
  )
}
