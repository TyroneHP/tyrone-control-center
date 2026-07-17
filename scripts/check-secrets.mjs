import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const valueDetectors = [
  {
    label: 'Supabase secret key',
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: 'Provider API key',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: 'Private key',
    pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g,
  },
]

const assignedSupabaseSecret =
  /\b(?:VITE_)?SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\b\s*[:=]\s*["']?([^\s"',}]+)/gi

function isPlaceholder(value) {
  const normalized = value.toLowerCase()
  return (
    value.startsWith('$') ||
    normalized.startsWith('env(') ||
    normalized.includes('placeholder') ||
    normalized.includes('example') ||
    normalized.includes('changeme') ||
    normalized.includes('replace-me') ||
    normalized.startsWith('your-') ||
    normalized === '...'
  )
}

export function detectSecrets(content) {
  const findings = []

  for (const detector of valueDetectors) {
    detector.pattern.lastIndex = 0
    if (detector.pattern.test(content)) {
      findings.push({ label: detector.label })
    }
  }

  assignedSupabaseSecret.lastIndex = 0
  for (const match of content.matchAll(assignedSupabaseSecret)) {
    const value = match[1]
    if (value.length >= 20 && !isPlaceholder(value)) {
      findings.push({ label: 'Assigned Supabase secret key' })
      break
    }
  }

  return findings
}

export function formatFinding(file, finding) {
  return `${file}: ${finding.label} detected (value redacted)`
}

function trackedFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
  return output.split('\0').filter(Boolean).map((file) => resolve(root, file))
}

function filesUnder(directory) {
  if (!existsSync(directory)) return []
  const files = []

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      files.push(...filesUnder(path))
    } else {
      files.push(path)
    }
  }

  return files
}

export function scanRepository(root = process.cwd()) {
  const files = new Set([
    ...trackedFiles(root),
    ...filesUnder(resolve(root, 'dist')),
  ])
  const findings = []

  for (const file of files) {
    const buffer = readFileSync(file)
    if (buffer.includes(0)) continue

    for (const finding of detectSecrets(buffer.toString('utf8'))) {
      findings.push({ file: relative(root, file).replaceAll('\\', '/'), finding })
    }
  }

  return findings
}

function main() {
  const findings = scanRepository()
  if (findings.length > 0) {
    console.error('Secret scan failed:')
    for (const { file, finding } of findings) {
      console.error(`- ${formatFinding(file, finding)}`)
    }
    process.exitCode = 1
    return
  }

  console.log('Secret scan passed: tracked files and dist contain no secret values.')
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/check-secrets.mjs')) {
  main()
}
