import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'
import { migrationTimestamp } from '../../../utils/naming'

export function generateTwoFactor(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''

  files.push({
    outputPath: `database/migrations/${migrationTimestamp(900)}_add_two_factor_to_users_table.php`,
    content: `<?php
${strict}
use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at']);
        });
    }
};
`,
  })

  files.push({
    outputPath: 'app/Http/Controllers/Auth/TwoFactorController.php',
    content: `<?php
${strict}
namespace App\\Http\\Controllers\\Auth;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Collection;
use Illuminate\\Support\\Str;
use PragmaRX\\Google2FA\\Google2FA;

class TwoFactorController extends Controller
{
    public function __construct(
        private readonly Google2FA $google2fa,
    ) {}

    public function enable(Request $request): JsonResponse
    {
        $user   = $request->user();
        $secret = $this->google2fa->generateSecretKey();

        $user->forceFill(['two_factor_secret' => encrypt($secret)])->save();

        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name'),
            $user->email,
            $secret,
        );

        return response()->json([
            'secret'      => $secret,
            'qr_code_url' => $qrCodeUrl,
        ]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'size:6']]);

        $user   = $request->user();
        $secret = decrypt($user->two_factor_secret);

        if (! $this->google2fa->verifyKey($secret, $request->code)) {
            return response()->json(['message' => 'Invalid code.'], 422);
        }

        $user->forceFill([
            'two_factor_confirmed_at'  => now(),
            'two_factor_recovery_codes' => encrypt(
                json_encode(Collection::times(8, fn () => Str::random(10) . '-' . Str::random(10))->all())
            ),
        ])->save();

        return response()->json(['message' => 'Two-factor authentication enabled.']);
    }

    public function disable(Request $request): JsonResponse
    {
        $request->user()->forceFill([
            'two_factor_secret'         => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at'   => null,
        ])->save();

        return response()->json(['message' => 'Two-factor authentication disabled.']);
    }

    public function recoveryCodes(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA is not enabled.'], 422);
        }

        return response()->json([
            'recovery_codes' => json_decode(decrypt($user->two_factor_recovery_codes), true),
        ]);
    }
}
`,
  })

  files.push({
    outputPath: 'app/Http/Middleware/EnsureTwoFactorEnabled.php',
    content: `<?php
${strict}
namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Symfony\\Component\\HttpFoundation\\Response;

class EnsureTwoFactorEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->two_factor_confirmed_at === null) {
            return response()->json([
                'message' => 'Two-factor authentication must be enabled.',
                'action'  => 'enable_2fa',
            ], 403);
        }

        return $next($request);
    }
}
`,
  })

  files.push({
    outputPath: 'routes/two-factor.php',
    content: `<?php

use App\\Http\\Controllers\\Auth\\TwoFactorController;
use Illuminate\\Support\\Facades\\Route;

Route::middleware('auth:sanctum')->prefix('auth/2fa')->group(function () {
    Route::post('enable',          [TwoFactorController::class, 'enable']);
    Route::post('confirm',         [TwoFactorController::class, 'confirm']);
    Route::post('disable',         [TwoFactorController::class, 'disable']);
    Route::get('recovery-codes',   [TwoFactorController::class, 'recoveryCodes']);
});
`,
  })

  warnings.push(
    'Two-Factor Auth: run `composer require pragmarx/google2fa-laravel bacon/bacon-qr-code`. ' +
    'Run `php artisan migrate` for the 2FA columns on users. ' +
    'Add two_factor_secret, two_factor_recovery_codes, two_factor_confirmed_at to your User $hidden array. ' +
    'Register Google2FA in a ServiceProvider: $this->app->singleton(Google2FA::class). ' +
    'Register EnsureTwoFactorEnabled middleware in bootstrap/app.php or Kernel.php.'
  )
}
