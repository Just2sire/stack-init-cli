import type { ProjectConfig, ServiceId } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'
import { generateEmail } from './email'
import { generateCache } from './cache'
import { generateQueue } from './queue'
import { generateFileUpload } from './file-upload'
import { generateWebsockets } from './websockets'

export function generateServices(
  config: ProjectConfig,
  services: ServiceId[],
  files: GeneratedFile[],
): void {
  for (const svc of services) {
    if (svc === 'auth') continue // auth is handled per-stack generator
    if (svc === 'email')       generateEmail(config, files)
    if (svc === 'cache')       generateCache(config, files)
    if (svc === 'queue')       generateQueue(config, files)
    if (svc === 'file-upload') generateFileUpload(config, files)
    if (svc === 'websockets')  generateWebsockets(config, files)
  }
}
