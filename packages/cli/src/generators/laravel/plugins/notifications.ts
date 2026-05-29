import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'

export function generateNotifications(config: ProjectConfig, files: GeneratedFile[], warnings: string[]): void {
  const strict = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''

  files.push({
    outputPath: 'app/Notifications/WelcomeNotification.php',
    content: `<?php
${strict}
namespace App\\Notifications;

use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Notifications\\Messages\\MailMessage;
use Illuminate\\Notifications\\Notification;

class WelcomeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $name,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Welcome to ' . config('app.name'))
            ->greeting('Hello ' . $this->name . '!')
            ->line('Your account has been created successfully.')
            ->action('Get Started', url('/'))
            ->line('Thank you for joining us!');
    }

    public function toDatabase(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'message' => 'Welcome ' . $this->name . '!',
        ];
    }
}
`,
  })

  warnings.push(
    'Notifications: add `use Illuminate\\Notifications\\Notifiable;` to your User model. ' +
    'Run `php artisan notifications:table && php artisan migrate` to create the notifications table.'
  )
}
