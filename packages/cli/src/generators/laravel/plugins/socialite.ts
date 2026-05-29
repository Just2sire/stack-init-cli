import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'

export function generateSocialite(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''
  const isPassport = config.laravel?.auth === 'passport'
  const tokenCreate = isPassport
    ? `$token = $user->createToken('auth_token')->accessToken;`
    : `$token = $user->createToken('auth_token')->plainTextToken;`

  files.push({
    outputPath: 'app/Http/Controllers/Auth/SocialiteController.php',
    content: `<?php
${strict}
namespace App\\Http\\Controllers\\Auth;

use App\\Http\\Controllers\\Controller;
use App\\Models\\User;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\Support\\Facades\\Hash;
use Illuminate\\Support\\Str;
use Laravel\\Socialite\\Facades\\Socialite;

class SocialiteController extends Controller
{
    private const SUPPORTED_PROVIDERS = ['google', 'github', 'facebook'];

    public function redirect(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, self::SUPPORTED_PROVIDERS), 404, 'Provider not supported.');

        return Socialite::driver($provider)->stateless()->redirect();
    }

    public function callback(string $provider): JsonResponse
    {
        abort_unless(in_array($provider, self::SUPPORTED_PROVIDERS), 404, 'Provider not supported.');

        $socialUser = Socialite::driver($provider)->stateless()->user();

        $user = User::firstOrCreate(
            ['email' => $socialUser->getEmail()],
            [
                'name'     => $socialUser->getName() ?? $socialUser->getNickname() ?? 'User',
                'password' => Hash::make(Str::random(24)),
            ]
        );

        ${tokenCreate}

        return response()->json([
            'token' => $token,
            'user'  => $user->only('id', 'name', 'email'),
        ]);
    }
}
`,
  })

  files.push({
    outputPath: 'routes/socialite.php',
    content: `<?php

use App\\Http\\Controllers\\Auth\\SocialiteController;
use Illuminate\\Support\\Facades\\Route;

Route::prefix('auth')->group(function () {
    Route::get('{provider}',          [SocialiteController::class, 'redirect'])->name('socialite.redirect');
    Route::get('{provider}/callback', [SocialiteController::class, 'callback'])->name('socialite.callback');
});
`,
  })

  files.push({
    outputPath: '.env.socialite.example',
    content: `# OAuth providers — fill in your app credentials

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=\${APP_URL}/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=\${APP_URL}/auth/github/callback

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_REDIRECT_URI=\${APP_URL}/auth/facebook/callback
`,
  })

  warnings.push(
    'Socialite: run `composer require laravel/socialite`. ' +
    'Add provider credentials to config/services.php and your .env. ' +
    'Register routes/socialite.php in bootstrap/app.php (L11+) or routes/api.php.'
  )
}
