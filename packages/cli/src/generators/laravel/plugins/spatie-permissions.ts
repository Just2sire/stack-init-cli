import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'

export function generateSpatiePermissions(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''

  const modelNames = config.models.map(m => m.name)
  const permissionLines = modelNames.flatMap(name => {
    const lower = name.toLowerCase()
    return [
      `        Permission::firstOrCreate(['name' => 'view ${lower}']);`,
      `        Permission::firstOrCreate(['name' => 'create ${lower}']);`,
      `        Permission::firstOrCreate(['name' => 'edit ${lower}']);`,
      `        Permission::firstOrCreate(['name' => 'delete ${lower}']);`,
    ]
  }).join('\n')

  const assignLines = modelNames.map(name => {
    const lower = name.toLowerCase()
    return `        $adminRole->givePermissionTo(['view ${lower}', 'create ${lower}', 'edit ${lower}', 'delete ${lower}']);`
  }).join('\n')

  files.push({
    outputPath: 'database/seeders/RolesPermissionsSeeder.php',
    content: `<?php
${strict}
namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;
use Spatie\\Permission\\Models\\Permission;
use Spatie\\Permission\\Models\\Role;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\\Spatie\\Permission\\PermissionRegistrar::class]->forgetCachedPermissions();

        // Permissions
${permissionLines}

        // Roles
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $userRole  = Role::firstOrCreate(['name' => 'user']);

        // Assign all permissions to admin
${assignLines}
    }
}
`,
  })

  files.push({
    outputPath: 'app/Http/Middleware/CheckPermission.php',
    content: `<?php
${strict}
namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Symfony\\Component\\HttpFoundation\\Response;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        if (! $request->user()?->can($permission)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}
`,
  })

  const laravelVer = parseInt(config.laravel?.laravel_version ?? '11')

  warnings.push(
    'Spatie Permissions: run `composer require spatie/laravel-permission`. ' +
    `Publish config: \`php artisan vendor:publish --provider="Spatie\\\\Permission\\\\PermissionServiceProvider"\`. ` +
    'Run `php artisan migrate` to create the roles/permissions tables. ' +
    'Add `use Spatie\\\\Permission\\\\Traits\\\\HasRoles;` to your User model. ' +
    (laravelVer >= 11
      ? 'Register CheckPermission in bootstrap/app.php: `->withMiddleware(fn($m) => $m->alias([\'permission\' => CheckPermission::class]))`.'
      : 'Register CheckPermission in app/Http/Kernel.php under $routeMiddleware.')
  )
}
