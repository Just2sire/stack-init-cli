import fs from 'node:fs'
import path from 'node:path'

export interface GeneratedFile {
  outputPath: string
  content: string
}

export async function writeFiles(files: GeneratedFile[], root: string, dryRun = false): Promise<void> {
  for (const file of files) {
    const full = path.join(root, file.outputPath)
    if (!dryRun) {
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, file.content, 'utf-8')
    }
  }
}
