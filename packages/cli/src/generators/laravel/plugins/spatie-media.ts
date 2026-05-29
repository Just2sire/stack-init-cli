import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'

export function generateSpatieMedia(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''

  files.push({
    outputPath: 'app/Http/Controllers/MediaController.php',
    content: `<?php
${strict}
namespace App\\Http\\Controllers;

use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Spatie\\MediaLibrary\\MediaCollections\\Models\\Media;

class MediaController extends Controller
{
    public function upload(Request $request, string $modelClass, int $modelId): JsonResponse
    {
        $request->validate([
            'file'       => ['required', 'file', 'max:10240'],
            'collection' => ['sometimes', 'string', 'max:64'],
        ]);

        $model = app($modelClass)->findOrFail($modelId);

        $media = $model
            ->addMediaFromRequest('file')
            ->toMediaCollection($request->input('collection', 'default'));

        return response()->json([
            'id'   => $media->id,
            'url'  => $media->getUrl(),
            'name' => $media->file_name,
            'size' => $media->size,
        ], 201);
    }

    public function destroy(Media $media): JsonResponse
    {
        $media->delete();

        return response()->json(['message' => 'Media deleted.']);
    }
}
`,
  })

  files.push({
    outputPath: 'routes/media.php',
    content: `<?php

use App\\Http\\Controllers\\MediaController;
use Illuminate\\Support\\Facades\\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('media/{modelClass}/{modelId}', [MediaController::class, 'upload']);
    Route::delete('media/{media}',              [MediaController::class, 'destroy']);
});
`,
  })

  const modelList = config.models.map(m => `// - ${m.name}: add HasMedia + InteractsWithMedia traits`).join('\n')

  warnings.push(
    'Spatie Media Library: run `composer require spatie/laravel-medialibrary`. ' +
    'Publish config: `php artisan vendor:publish --provider="Spatie\\\\MediaLibrary\\\\MediaLibraryServiceProvider" --tag="medialibrary-migrations"`. ' +
    'Run `php artisan migrate`. ' +
    'Add HasMedia + InteractsWithMedia to your models:\n' + modelList
  )
}
