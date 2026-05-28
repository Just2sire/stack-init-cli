import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateEmail(config: ProjectConfig, files: GeneratedFile[]): void {
  const stack = config.stack as string

  if (stack.includes('laravel')) {
    files.push({
      outputPath: 'app/Mail/WelcomeMail.php',
      content: `<?php

namespace App\\Mail;

use Illuminate\\Bus\\Queueable;
use Illuminate\\Mail\\Mailable;
use Illuminate\\Mail\\Mailables\\Content;
use Illuminate\\Mail\\Mailables\\Envelope;
use Illuminate\\Queue\\SerializesModels;

class WelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $userName) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Welcome to ${config.name}!');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.welcome');
    }
}
`,
    })

    files.push({
      outputPath: 'resources/views/emails/welcome.blade.php',
      content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome</title></head>
<body>
  <h1>Welcome, {{ $userName }}!</h1>
  <p>Thanks for joining ${config.name}.</p>
</body>
</html>
`,
    })

    files.push({
      outputPath: '.env.mail.example',
      content: `MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@${config.name}.com"
MAIL_FROM_NAME="\${APP_NAME}"
`,
    })
    return
  }

  if (stack.includes('nestjs')) {
    files.push({
      outputPath: 'src/mail/mail.module.ts',
      content: `import { Module } from '@nestjs/common'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { join } from 'path'
import { MailService } from './mail.service'

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaults: { from: \`"\${process.env.MAIL_FROM_NAME}" <\${process.env.MAIL_FROM_ADDRESS}>\` },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: { strict: true },
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
`,
    })

    files.push({
      outputPath: 'src/mail/mail.service.ts',
      content: `import { Injectable } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  async sendWelcome(email: string, name: string): Promise<void> {
    await this.mailer.sendMail({
      to: email,
      subject: 'Welcome!',
      template: 'welcome',
      context: { name },
    })
  }
}
`,
    })

    files.push({
      outputPath: 'src/mail/templates/welcome.hbs',
      content: `<h1>Welcome, {{name}}!</h1>
<p>Thanks for joining ${config.name}.</p>
`,
    })

    files.push({
      outputPath: '.env.mail.example',
      content: `SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
MAIL_FROM_ADDRESS=hello@${config.name}.com
MAIL_FROM_NAME=${config.name}
`,
    })
    return
  }

  if (stack.includes('fastapi')) {
    files.push({
      outputPath: 'app/services/email.py',
      content: `from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
import os

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USER", ""),
    MAIL_PASSWORD=os.getenv("SMTP_PASS", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "hello@${config.name}.com"),
    MAIL_PORT=int(os.getenv("SMTP_PORT", "587")),
    MAIL_SERVER=os.getenv("SMTP_HOST", "smtp.mailtrap.io"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

fm = FastMail(conf)


async def send_welcome_email(email: EmailStr, name: str) -> None:
    message = MessageSchema(
        subject="Welcome!",
        recipients=[email],
        body=f"<h1>Welcome, {name}!</h1><p>Thanks for joining ${config.name}.</p>",
        subtype="html",
    )
    await fm.send_message(message)
`,
    })

    files.push({
      outputPath: '.env.mail.example',
      content: `SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
MAIL_FROM=hello@${config.name}.com
`,
    })
    return
  }

  // Express (default Node)
  files.push({
    outputPath: 'src/config/email.ts',
    content: `import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})
`,
  })

  files.push({
    outputPath: 'src/services/email.service.ts',
    content: `import { transporter } from '../config/email'

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? 'hello@${config.name}.com',
    to,
    subject: 'Welcome!',
    html: \`<h1>Welcome, \${name}!</h1><p>Thanks for joining ${config.name}.</p>\`,
  })
}
`,
  })

  files.push({
    outputPath: '.env.mail.example',
    content: `SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_pass
MAIL_FROM=hello@${config.name}.com
`,
  })
}
