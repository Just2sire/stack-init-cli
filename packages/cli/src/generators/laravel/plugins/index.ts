import type { ProjectConfig, LaravelPluginId } from '@stack-init/schema'
import type { GeneratedFile } from '../../../utils/fs'
import { generateNotifications }      from './notifications'
import { generateSocialite }          from './socialite'
import { generateSpatiePermissions }  from './spatie-permissions'
import { generateSpatieMedia }        from './spatie-media'
import { generateSpatieActivity }     from './spatie-activity'
import { generateHorizon }            from './horizon'
import { generateTwoFactor }          from './two-factor'

export function generateLaravelPlugins(
  config: ProjectConfig,
  files: GeneratedFile[],
  warnings: string[],
): void {
  const plugins = (config.laravel_plugins ?? []) as LaravelPluginId[]
  if (plugins.length === 0) return

  for (const plugin of plugins) {
    switch (plugin) {
      case 'notifications':     generateNotifications(config, files, warnings);     break
      case 'socialite':         generateSocialite(config, files, warnings);         break
      case 'spatie-permissions':generateSpatiePermissions(config, files, warnings); break
      case 'spatie-media':      generateSpatieMedia(config, files, warnings);       break
      case 'spatie-activity':   generateSpatieActivity(config, files, warnings);    break
      case 'horizon':           generateHorizon(config, files, warnings);           break
      case 'two-factor-auth':   generateTwoFactor(config, files, warnings);         break
    }
  }
}
