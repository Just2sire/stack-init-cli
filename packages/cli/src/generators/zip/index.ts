import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import type { ProjectConfig } from '@stack-init/schema'
import { type GeneratedFile } from '../../utils/fs'
import { resolveTemplatesDir } from '../../utils/template-path'

const TEMPLATES_DIR = resolveTemplatesDir('zip')

export interface ZipGeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class ZipGenerator {
  async generate(config: ProjectConfig, projectRoot: string, type: 'react' | 'nextjs'): Promise<ZipGeneratorResult> {
    const result: ZipGeneratorResult = { files: [], warnings: [] }
    
    const zipPath = path.join(TEMPLATES_DIR, `${type}.zip`)
    
    if (!fs.existsSync(zipPath)) {
      result.warnings.push(`ZIP template not found for ${type} at ${zipPath}`)
      return result
    }

    try {
      const zip = new AdmZip(zipPath)
      const zipEntries = zip.getEntries()

      for (const entry of zipEntries) {
        if (!entry.isDirectory) {
          let content = entry.getData().toString('utf8')
          
          // Simple substitution for project name in package.json
          if (entry.entryName === 'package.json') {
            try {
              const pkg = JSON.parse(content)
              pkg.name = config.name.toLowerCase().replace(/\s+/g, '-')
              content = JSON.stringify(pkg, null, 2)
            } catch {
              // Ignore parse errors
            }
          }

          result.files.push({
            outputPath: entry.entryName,
            content
          })
        }
      }
    } catch (error: any) {
      result.warnings.push(`Failed to extract ${type} ZIP: ${error.message}`)
    }

    return result
  }
}
