import fs from 'fs'
import path from 'path'

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex === -1) return null

  const key = trimmed.slice(0, separatorIndex).trim()
  let value = trimmed.slice(separatorIndex + 1).trim()

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }

  return { key, value }
}

function loadLocalEnv() {
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue

    const contents = fs.readFileSync(filePath, 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line)
      if (!parsed) continue
      if (process.env[parsed.key] == null || process.env[parsed.key] === '') {
        process.env[parsed.key] = parsed.value
      }
    }
  }
}

loadLocalEnv()

const baseUrl = process.env.INDEXER_BASE_URL || process.env.APP_BASE_URL || 'http://127.0.0.1:3000'
const token = process.env.DASHBOARD_PREWARM_TOKEN || process.env.CRON_SECRET
const force = process.argv.includes('--force') ? '1' : '0'

if (!token) {
  console.error('DASHBOARD_PREWARM_TOKEN or CRON_SECRET is required')
  process.exit(1)
}

const url = new URL('/api/internal/dashboard-index', baseUrl)
url.searchParams.set('force', force)

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
})

const text = await response.text()
if (!response.ok) {
  console.error(`Dashboard index worker failed (${response.status}): ${text}`)
  process.exit(1)
}

console.log(text)
